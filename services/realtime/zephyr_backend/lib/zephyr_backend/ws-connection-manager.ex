defmodule ZephyrBackend.WSConnectionManager do
  @moduledoc """
  Manages WebSocket connections to the Go AI server.
  """

  use GenServer
  require Logger

  @ws_url "ws://localhost:8080/ws"

  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def get_connection(chat_id) do
    case :ets.lookup(:ws_connections, chat_id) do
      [{^chat_id, pid}] -> {:ok, pid}
      [] -> create_connection(chat_id)
    end
  end

  def init(_opts) do
    :ets.new(:ws_connections, [:named_table, :set, :public])
    {:ok, %{}}
  end

  defp create_connection(chat_id) do
    case DynamicSupervisor.start_child(
      ZephyrBackend.WSConnectionSupervisor,
      {WebSockex, {
        @ws_url,
        ZephyrWeb.ChatChannel,
        %{chat_id: chat_id},
        [name: via_tuple(chat_id)]
      }}
    ) do
      {:ok, pid} ->
        :ets.insert(:ws_connections, {chat_id, pid})
        {:ok, pid}
      error ->
        Logger.error("Failed to create WebSocket connection: #{inspect(error)}")
        error
    end
  end

  defp via_tuple(chat_id) do
    {:via, Registry, {ZephyrBackend.WSRegistry, chat_id}}
  end

  # Handle connection cleanup
  def handle_info({:DOWN, _ref, :process, pid, _reason}, state) do
    case :ets.match(:ws_connections, {~c'$1', pid}) do
      [[chat_id]] ->
        :ets.delete(:ws_connections, chat_id)
      _ -> :ok
    end
    {:noreply, state}
  end
end
