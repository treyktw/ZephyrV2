import gleam/http
import gleam/http/request
import gleam/http/response
import mist

pub fn main() {
  let handler = fn(req) {
    response.new(200)
    |> response.set_body("Hello from Gleam!")
  }

  let service = mist.new(handler)
  mist.start(service, on_port: 3003)
}
