defmodule ZephyrBackendWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :zephyr_backend

  # The session will be stored in the cookie and signed,
  # this means its contents can be read but not tampered with.
  # Set :encryption_salt if you would also like to encrypt it.
  @session_options [
    store: :cookie,
    key: "_zephyr_backend_key",
    signing_salt: "+V/UuWuu",
    same_site: "Lax"
  ]

  socket("/live", Phoenix.LiveView.Socket,
    websocket: [connect_info: [session: @session_options]],
    longpoll: [connect_info: [session: @session_options]]
  )

  socket("/socket", ZephyrWeb.UserSocket,
    websocket: [
      timeout: 45_000,
    ],
    longpoll: false
  )

  # Add CORS for NextJS
  plug(Corsica,
    origins: ["http://localhost:3000"],
    allow_credentials: true,
    allow_headers: ["content-type"]
  )

  plug(Plug.Session,
    store: :cookie,
    key: "_zephyr_key",
    signing_salt: "some_signing_salt"
  )

  # Serve at "/" the static files from "priv/static" directory.
  #
  # You should set gzip to true if you are running phx.digest
  # when deploying your static files in production.
  plug(Plug.Static,
    at: "/",
    from: :zephyr_backend,
    gzip: false,
    only: ZephyrBackendWeb.static_paths()
  )

  # Code reloading can be explicitly enabled under the
  # :code_reloader configuration of your endpoint.
  if code_reloading? do
    plug(Phoenix.CodeReloader)
  end

  plug(Phoenix.LiveDashboard.RequestLogger,
    param_key: "request_logger",
    cookie_key: "request_logger"
  )

  plug(Plug.RequestId)
  plug(Plug.Telemetry, event_prefix: [:phoenix, :endpoint])

  plug(Plug.Parsers,
    parsers: [:urlencoded, :multipart, :json],
    pass: ["*/*"],
    json_decoder: Phoenix.json_library()
  )

  plug(Plug.MethodOverride)
  plug(Plug.Head)
  plug(Plug.Session, @session_options)
  plug(ZephyrBackendWeb.Router)
  plug(CORSPlug)
end
