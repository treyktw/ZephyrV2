# docker/csharp/Dockerfile
FROM mcr.microsoft.com/dotnet/sdk:7.0

# Create non-root user with home directory
RUN useradd -m -d /home/compiler -r -g users compiler

# Set environment variables for dotnet
ENV DOTNET_CLI_HOME=/home/compiler
ENV DOTNET_NOLOGO=true
ENV DOTNET_SKIP_FIRST_TIME_EXPERIENCE=true
ENV DOTNET_CLI_TELEMETRY_OPTOUT=true

# Create workspace directory
WORKDIR /workspace

# Create a basic project structure
RUN dotnet new console --no-restore && \
    dotnet restore && \
    # Set permissions
    chown -R compiler:users /workspace && \
    chown -R compiler:users /home/compiler && \
    chmod -R 755 /workspace && \
    chmod -R 755 /home/compiler

# Switch to non-root user
USER compiler

# Verify setup with a simple program
RUN dotnet new console --force && \
    dotnet run

# Keep container running
CMD ["tail", "-f", "/dev/null"]
