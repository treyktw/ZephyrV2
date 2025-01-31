#!/bin/bash
# scripts/generate-protos.sh

# Go
protoc -I protos \
  --go_out=. \
  --go_opt=paths=source_relative \
  --go-grpc_out=. \
  --go-grpc_opt=paths=source_relative \
  protos/**/*.proto

# Rust
protoc -I protos \
  --rust_out=services/compute/src/generated \
  --tonic_out=services/compute/src/generated \
  protos/**/*.proto

# Elixir
protoc -I protos \
  --elixir_out=plugins=grpc:services/realtime/lib/generated \
  protos/**/*.proto
