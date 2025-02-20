# docker/cpp/Dockerfile
FROM ubuntu:22.04

# Avoid prompts from apt
ENV DEBIAN_FRONTEND=noninteractive

# Install build essentials and compilers
RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    g++ \
    cmake \
    gdb \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r compiler && useradd -r -g compiler compiler

# Create workspace directory
WORKDIR /workspace

# Set permissions
RUN chown -R compiler:compiler /workspace && \
    chmod -R 755 /workspace

# Switch to non-root user
USER compiler

# Verify setup
RUN echo '#include <stdio.h>\nint main() { printf("C setup verification\\n"); return 0; }' > test.c && \
    gcc test.c -o test && \
    ./test && \
    rm test.c test

# Keep container running
CMD ["tail", "-f", "/dev/null"]
