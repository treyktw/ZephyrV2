FROM rust:1.74 as builder

WORKDIR /usr/src/app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
COPY --from=builder /usr/src/app/target/release/zephyr-compute /usr/local/bin/
CMD ["zephyr-compute"]
