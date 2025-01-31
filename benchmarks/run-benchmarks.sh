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
