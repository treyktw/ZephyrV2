defmodule ZephyrBackend.Application do
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      # Telemetry and core services
      ZephyrBackendWeb.Telemetry,
      {DNSCluster, query: Application.get_env(:zephyr_backend, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: ZephyrBackend.PubSub},

      # Finch HTTP client
      {Finch, name: ZephyrBackend.Finch},

      # WebSocket connection supervisor
      {DynamicSupervisor,
        strategy: :one_for_one,
        name: ZephyrBackend.WSConnectionSupervisor
      },

      # Start the endpoint last
      ZephyrBackendWeb.Endpoint
    ]

    opts = [strategy: :one_for_one, name: ZephyrBackend.Supervisor]
    Supervisor.start_link(children, opts)
  end

  @impl true
  def config_change(changed, _new, removed) do
    ZephyrBackendWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
