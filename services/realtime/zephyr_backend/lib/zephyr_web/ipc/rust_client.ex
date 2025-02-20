# lib/zephyr_web/ipc/rust_client.ex
# example rust client
defmodule ZephyrWeb.IPC.RustClient do
  use GenServer
  require Logger

  @timeout 300_000  # 5 minutes timeout

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, nil, name: __MODULE__)
  end

  def init(_) do
    with {:ok, pull_socket} <- :chumak.socket(:pull),
         {:ok, push_socket} <- :chumak.socket(:push),
         {:ok, _} <- :chumak.connect(push_socket, :tcp, 'localhost', 5556, []),
         {:ok, _} <- :chumak.connect(pull_socket, :tcp, 'localhost', 5555, []) do

      Logger.info("✅ Connected to Rust IPC at localhost:5555/5556")
      {:ok, %{push_socket: push_socket, pull_socket: pull_socket}}
    else
      {:error, reason} ->
        Logger.error("❌ Failed to initialize sockets: #{inspect(reason)}")
        {:stop, reason}
      error ->
        Logger.error("❌ Unexpected error during initialization: #{inspect(error)}")
        {:stop, error}
    end
  end

  def process_message(message) do
    GenServer.call(__MODULE__, {:process, message}, @timeout)
  end

  def handle_call({:process, message}, {pid, _} = from, state) do
    Logger.info("🔄 Sending message to Rust service: #{inspect(message)}")

    # Track the requesting process for token streaming
    new_state = Map.put(state, :requesting_pid, pid)

    # Send the initial message
    case :chumak.send(state.push_socket, Jason.encode!(%{content: message})) do
      :ok ->
        # Start receiving responses in a separate process
        Task.start(fn -> receive_responses(state.pull_socket, pid) end)
        {:noreply, new_state}
      {:error, reason} ->
        Logger.error("❌ Failed to send message: #{inspect(reason)}")
        {:reply, {:error, reason}, state}
    end
  end

  defp receive_responses(pull_socket, requesting_pid) do
    case :chumak.recv(pull_socket) do
      {:ok, message} ->
        case Jason.decode(message) do
          {:ok, %{"status" => "stream", "token" => token} = response} ->
            Logger.info("📝 Received token: #{inspect(token)}")
            send(requesting_pid, {:token, token})
            receive_responses(pull_socket, requesting_pid)

          {:ok, %{"status" => "complete"}} ->
            Logger.info("✅ Stream complete")
            send(requesting_pid, :complete)

          {:ok, %{"status" => "error"} = error} ->
            Logger.error("❌ Error from Rust service: #{inspect(error)}")
            send(requesting_pid, {:error, error})

          {:error, decode_error} ->
            Logger.error("❌ Failed to decode message: #{inspect(decode_error)}")
            send(requesting_pid, {:error, "Message decode failed"})
        end

      {:error, reason} ->
        Logger.error("❌ Failed to receive response: #{inspect(reason)}")
        send(requesting_pid, {:error, "Failed to receive response"})
    end
  end
end
