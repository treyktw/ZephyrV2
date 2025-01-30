defmodule ZephyrRealtime.Application do
  use Application

  def start(_type, _args) do
    children = [
      # Add supervisors and workers here
    ]

    opts = [strategy: :one_for_one, name: ZephyrRealtime.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
