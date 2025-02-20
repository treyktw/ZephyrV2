defmodule ZephyrWeb.GoWebSocket do
  use WebSockex
  require Logger

  def start_link(url, state) do
    Logger.info("Starting WebSocket connection to #{url}")
    WebSockex.start_link(url, __MODULE__, state)
  end

  @impl true
  def handle_connect(_conn, state) do
    Logger.info("WebSocket connected, sending initial message")

    message = %{
      type: "chat",
      content: state.content,
      message_id: state.message_id
    }

    with {:ok, json} <- Jason.encode(message) do
      {:reply, {:text, json}, state}
    else
      error ->
        Logger.error("Failed to encode message: #{inspect(error)}")
        {:close, state}
    end
  end

  @impl true
  def handle_frame({:text, msg}, state) do
    Logger.debug("Received frame: #{inspect(msg)}")

    case Jason.decode(msg) do
      {:ok, %{"type" => "token", "content" => content}} ->
        send(state.socket, {:ai_stream, content})
        {:ok, state}

      {:ok, %{"type" => "complete"}} ->
        send(state.socket, :ai_complete)
        {:close, state}

      {:ok, %{"type" => "error", "content" => error}} ->
        send(state.socket, {:ai_error, error})
        {:close, state}

      {:error, error} ->
        Logger.error("Failed to decode message: #{inspect(error)}")
        {:ok, state}
    end
  end

  @impl true
  def handle_disconnect(%{reason: reason}, state) do
    Logger.info("WebSocket disconnected: #{inspect(reason)}")
    {:ok, state}
  end

  @impl true
  def terminate(reason, state) do
    Logger.info("WebSocket terminated: #{inspect(reason)}")
    {:ok, state}
  end
end
