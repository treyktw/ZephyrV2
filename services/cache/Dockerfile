FROM ghcr.io/gleam-lang/gleam:v0.32.0-erlang-alpine AS builder

WORKDIR /app
COPY . .
RUN gleam build

FROM alpine:3.18
WORKDIR /app
COPY --from=builder /app/_build ./
CMD ["./zephyr_cache"]
