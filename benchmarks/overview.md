# ZephyrV2 Monitoring & Benchmarking Configuration

## Monitoring Stack Setup

### 1. Core Monitoring Components

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:v2.45.0
    volumes:
      - ./monitoring/prometheus:/etc/prometheus
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/usr/share/prometheus/console_libraries'
      - '--web.console.templates=/usr/share/prometheus/consoles'
    ports:
      - "9090:9090"
    networks:
      - monitoring_network

  grafana:
    image: grafana/grafana:10.0.0
    volumes:
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning
      - grafana_data:/var/lib/grafana
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=zephyradmin
      - GF_USERS_ALLOW_SIGN_UP=false
    ports:
      - "3000:3000"
    networks:
      - monitoring_network

  jaeger:
    image: jaegertracing/all-in-one:1.47
    ports:
      - "16686:16686"  # UI
      - "4317:4317"    # OTLP gRPC
      - "4318:4318"    # OTLP HTTP
    environment:
      - COLLECTOR_OTLP_ENABLED=true
    networks:
      - monitoring_network

  loki:
    image: grafana/loki:2.9.0
    ports:
      - "3100:3100"
    command: -config.file=/etc/loki/local-config.yaml
    networks:
      - monitoring_network

  prometheus-node-exporter:
    image: prom/node-exporter:v1.6.1
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.rootfs=/rootfs'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($|/)'
    ports:
      - "9100:9100"
    networks:
      - monitoring_network

networks:
  monitoring_network:
    driver: bridge

volumes:
  prometheus_data:
  grafana_data:
```

### 2. Prometheus Configuration

```yaml
# monitoring/prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['prometheus-node-exporter:9100']

  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx-exporter:9113']

  - job_name: 'go-gateway'
    static_configs:
      - targets: ['gateway:8080']

  - job_name: 'rust-compute'
    static_configs:
      - targets: ['compute:8081']
```

## Benchmarking Tools & Configurations

### 1. k6 Load Testing

```javascript
// benchmarks/k6/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 20 },   // Ramp up
    { duration: '3m', target: 20 },   // Stay at peak
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must finish within 500ms
    http_req_failed: ['rate<0.01'],   // Less than 1% can fail
  },
};

const BASE_URL = 'http://localhost';

export default function () {
  const responses = http.batch([
    ['GET', `${BASE_URL}/api/health`],
    ['GET', `${BASE_URL}/api/features`],
  ]);

  check(responses[0], {
    'health check status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
```

### 2. Automated Benchmark Script

```bash
#!/bin/bash
# benchmarks/run-benchmarks.sh

set -e

echo "Starting ZephyrV2 Benchmarking Suite"

# System Benchmarks
echo "Running System Benchmarks..."
sysbench cpu --cpu-max-prime=20000 run
sysbench memory --memory-block-size=1K --memory-total-size=100G run

# Database Benchmarks
echo "Running Database Benchmarks..."
pgbench -i -s 50 zephyr  # Initialize
pgbench -c 10 -j 2 -t 1000 zephyr  # Run benchmark

# API Load Testing
echo "Running k6 Load Tests..."
k6 run benchmarks/k6/load-test.js

# Network Performance
echo "Running Network Tests..."
iperf3 -c localhost -p 5201 -t 30

# Collect and Format Results
echo "Collecting Results..."
```

## Application Metrics Collection

### 1. Next.js Web Metrics

```typescript
// apps/web/src/lib/monitoring.ts
import { metrics } from 'next-metrics';

export const webMetrics = {
  // Core Web Vitals
  FCP: metrics.create('FCP'),
  LCP: metrics.create('LCP'),
  FID: metrics.create('FID'),
  CLS: metrics.create('CLS'),

  // Custom Metrics
  apiLatency: metrics.create('API_LATENCY'),
  renderTime: metrics.create('RENDER_TIME'),
  memoryUsage: metrics.create('MEMORY_USAGE'),
};
```

### 2. Go Gateway Metrics

```go
// services/gateway/internal/metrics/metrics.go
package metrics

import (
    "github.com/prometheus/client_golang/prometheus"
)

var (
    RequestDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name: "http_request_duration_seconds",
            Help: "Time spent processing HTTP requests",
            Buckets: prometheus.DefBuckets,
        },
        []string{"method", "route"},
    )

    RequestsTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "http_requests_total",
            Help: "Total number of HTTP requests",
        },
        []string{"method", "route", "status"},
    )

    ActiveConnections = prometheus.NewGauge(
        prometheus.GaugeOpts{
            Name: "active_connections",
            Help: "Number of currently active connections",
        },
    )
)
```

### 3. Rust Service Metrics

```rust
// services/compute/src/metrics.rs
use prometheus::{
    Histogram, HistogramOpts, IntCounter, IntCounterVec, IntGauge, Opts, Registry,
};

lazy_static! {
    pub static ref COMPUTATION_TIME: Histogram = Histogram::with_opts(
        HistogramOpts::new(
            "computation_duration_seconds",
            "Time spent on computations"
        )
    ).unwrap();

    pub static ref COMPUTATION_ERRORS: IntCounterVec = IntCounterVec::new(
        Opts::new("computation_errors", "Number of computation errors"),
        &["type"]
    ).unwrap();
}
```

## Grafana Dashboards

### 1. System Overview Dashboard

```json
{
  "dashboard": {
    "id": null,
    "title": "ZephyrV2 System Overview",
    "tags": ["overview"],
    "timezone": "browser",
    "panels": [
      {
        "title": "CPU Usage",
        "type": "graph",
        "datasource": "Prometheus",
        "targets": [
          {
            "expr": "rate(node_cpu_seconds_total{mode='idle'}[1m])",
            "legendFormat": "{{cpu}}"
          }
        ]
      },
      {
        "title": "Memory Usage",
        "type": "graph",
        "datasource": "Prometheus",
        "targets": [
          {
            "expr": "node_memory_MemTotal_bytes - node_memory_MemFree_bytes",
            "legendFormat": "Used Memory"
          }
        ]
      }
    ]
  }
}
```

## Performance Testing Automation

```yaml
# .github/workflows/performance.yml
name: Performance Testing

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup k6
        uses: grafana/k6-action@v0.3.0

      - name: Run k6 Load Test
        run: k6 run benchmarks/k6/load-test.js

      - name: Upload Results
        uses: actions/upload-artifact@v3
        with:
          name: k6-results
          path: k6-results.json
```

## Alert Configurations

```yaml
# monitoring/prometheus/alerts.yml
groups:
  - name: ZephyrV2Alerts
    rules:
      - alert: HighCPUUsage
        expr: 100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High CPU usage detected
          description: CPU usage is above 80% for 5 minutes

      - alert: HighMemoryUsage
        expr: (node_memory_MemTotal_bytes - node_memory_MemFree_bytes) / node_memory_MemTotal_bytes * 100 > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High memory usage detected
          description: Memory usage is above 85% for 5 minutes
```

## Usage Instructions

1. Start monitoring stack:
```bash
docker-compose -f docker-compose.monitoring.yml up -d
```

2. Access monitoring interfaces:
- Grafana: http://localhost:3000
- Prometheus: http://localhost:9090
- Jaeger: http://localhost:16686

3. Run benchmarks:
```bash
./benchmarks/run-benchmarks.sh
```

4. View results in Grafana:
- System metrics dashboard
- Application metrics dashboard
- Error tracking dashboard

## Key Metrics to Monitor

### System Metrics
- CPU Usage
- Memory Usage
- Disk I/O
- Network I/O
- System Load

### Application Metrics
- Request Latency
- Error Rates
- Active Users
- API Response Times
- Database Query Times

### Business Metrics
- User Sessions
- Feature Usage
- Conversion Rates
- User Engagement
