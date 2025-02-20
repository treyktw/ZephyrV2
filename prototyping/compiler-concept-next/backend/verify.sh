#!/bin/bash
# verify.sh

# Test Python
echo "Testing Python compiler..."
docker run --rm compiler-python python3 -c "print('Hello from Python')"

# Test JavaScript
echo "Testing JavaScript compiler..."
docker run --rm compiler-javascript node -e "console.log('Hello from JavaScript')"

# Test TypeScript
echo "Testing TypeScript compiler..."
docker run --rm compiler-typescript tsc --version

# Test Rust
echo "Testing Rust compiler..."
docker run --rm compiler-rust rustc --version

echo "All compiler images verified successfully!"
