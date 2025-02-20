# lib/zephyr_web/channels/user_socket.ex
defmodule ZephyrWeb.UserSocket do
  use Phoenix.Socket
  require Logger

  ## Channels
  channel "chat:*", ZephyrWeb.ChatChannel

  @impl true
  def connect(params, socket, _connect_info) do
    Logger.info("🔵 Socket connect attempt with params: #{inspect(params)}")
    {:ok, socket}
  end

  @impl true
  def id(_socket), do: nil
end
