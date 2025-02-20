# docker/zig/Dockerfile
FROM ubuntu:22.04

# Avoid prompts from apt
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies
RUN apt-get update && apt-get install -y \
    wget \
    xz-utils \
    && rm -rf /var/lib/apt/lists/*

# Install Zig
RUN wget https://ziglang.org/download/0.11.0/zig-linux-x86_64-0.11.0.tar.xz && \
    tar -xf zig-linux-x86_64-0.11.0.tar.xz && \
    mv zig-linux-x86_64-0.11.0 /usr/local/zig && \
    rm zig-linux-x86_64-0.11.0.tar.xz

# Add Zig to PATH
ENV PATH="/usr/local/zig:${PATH}"

# Create non-root user with home directory
RUN useradd -m -d /home/compiler compiler

# Create and set up workspace directory
WORKDIR /workspace
RUN mkdir -p /workspace/zig-cache && \
    chown -R compiler:compiler /workspace && \
    chmod -R 755 /workspace && \
    chown -R compiler:compiler /home/compiler && \
    chmod -R 755 /home/compiler

# Switch to non-root user
USER compiler

# Create a simple build.zig file
RUN echo 'const std = @import("std");\n\
pub fn build(b: *std.Build) void {\n\
    const target = b.standardTargetOptions(.{});\n\
    const optimize = b.standardOptimizeOption(.{});\n\
    const exe = b.addExecutable(.{\n\
        .name = "test",\n\
        .root_source_file = .{ .path = "src/main.zig" },\n\
        .target = target,\n\
        .optimize = optimize,\n\
    });\n\
    b.installArtifact(exe);\n\
}' > build.zig

# Verify the setup without writing to root-owned directories
RUN mkdir -p src && \
    echo 'const std = @import("std");\n\
pub fn main() !void {\n\
    const stdout = std.io.getStdOut().writer();\n\
    try stdout.print("Zig setup verification\\n", .{});\n\
}' > src/main.zig && \
    zig build && \
    ./zig-out/bin/test && \
    rm -rf zig-out src

# Keep container running
CMD ["tail", "-f", "/dev/null"]
