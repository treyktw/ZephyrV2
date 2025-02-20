# lib/zephyr_web/channels/chat_channel.ex
defmodule ZephyrWeb.ChatChannel do
  use Phoenix.Channel
  require Logger

  @go_server_url "ws://localhost:8000/chat"

  def join("chat:" <> chat_id, _params, socket) do
    Logger.info("Client joined chat:#{chat_id}")
    {:ok, assign(socket, :chat_id, chat_id)}
  end

  def handle_in("new_message", %{"content" => content}, socket) do
    Logger.info("Processing message: #{inspect(content)}")

    message_id = "msg_" <> Base.encode16(:crypto.strong_rand_bytes(8), case: :lower)

    case WebSockex.start_link(
      @go_server_url,
      ZephyrWeb.GoWebSocket,
      %{
        content: content,
        message_id: message_id,
        socket: self()
      }
    ) do
      {:ok, pid} ->
        Process.monitor(pid)
        {:reply, :ok, assign(socket, :ws_pid, pid)}

      {:error, reason} ->
        Logger.error("Failed to connect to Go server: #{inspect(reason)}")
        {:reply, {:error, %{reason: "server_connection_failed"}}, socket}
    end
  end

  def handle_info({:ai_stream, content}, socket) do
    broadcast!(socket, "ai_stream", %{
      content: content,
      type: "text",
      metadata: %{streaming: true}
    })
    {:noreply, socket}
  end

  def handle_info(:ai_complete, socket) do
    broadcast!(socket, "ai_complete", %{})
    {:noreply, socket}
  end

  def handle_info({:ai_error, error}, socket) do
    broadcast!(socket, "ai_error", %{
      content: error,
      type: "error"
    })
    {:noreply, socket}
  end

  def handle_info({:DOWN, _ref, :process, pid, reason}, socket) do
    ws_pid = socket.assigns[:ws_pid]
    if pid == ws_pid do
      Logger.info("WebSocket process down: #{inspect(reason)}")
    end
    {:noreply, socket}
  end
end
