FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY . .
RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -o gateway ./cmd/server

FROM alpine:latest
WORKDIR /app
COPY --from=builder /app/gateway .
CMD ["./gateway"]
