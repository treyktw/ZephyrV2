defmodule ZephyrRealtime.MixProject do
  use Mix.Project

  def project do
    [
      app: :zephyr_realtime,
      version: "0.1.0",
      elixir: "~> 1.15",
      start_permanent: Mix.env() == :prod,
      deps: deps()
    ]
  end

  def application do
    [
      extra_applications: [:logger],
      mod: {ZephyrRealtime.Application, []}
    ]
  end

  defp deps do
    [
      {:phoenix, "~> 1.7.10"},
      {:phoenix_pubsub, "~> 2.1"},
      {:jason, "~> 1.4"},
      {:plug_cowboy, "~> 2.6"},
      {:ecto_sql, "~> 3.10"},
      {:postgrex, ">= 0.0.0"}
    ]
  end
end
