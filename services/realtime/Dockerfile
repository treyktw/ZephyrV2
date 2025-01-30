FROM elixir:1.15-alpine AS builder

WORKDIR /app
COPY . .
RUN mix local.hex --force && \
    mix local.rebar --force && \
    mix deps.get && \
    mix release

FROM alpine:3.18
WORKDIR /app
COPY --from=builder /app/_build/prod/rel/zephyr_realtime ./
CMD ["bin/zephyr_realtime", "start"]
