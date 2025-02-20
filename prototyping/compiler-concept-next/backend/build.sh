#!/bin/bash
# build.sh

# Exit on any error
set -e

echo "Starting compiler images build process..."

# Function to build image
build_image() {
    local name=$1
    local file=$2
    echo "Building $name compiler image..."
    if [ ! -f "$file" ]; then
        echo "Error: Dockerfile not found at $file"
        exit 1
    fi
    docker build -t "compiler-$name" -f "$file" .
    echo "$name compiler image built successfully"
}

# Build Python image
build_image "python" "D:\Vscode\Project_folder\ZephyrV2\prototyping\compiler-concept-next\backend\docker\python\DockerFIle"

# Build JavaScript/TypeScript image
build_image "javascript" "D:\Vscode\Project_folder\ZephyrV2\prototyping\compiler-concept-next\backend\docker\javascript\DockerFIle"
build_image "typescript" "D:\Vscode\Project_folder\ZephyrV2\prototyping\compiler-concept-next\backend\docker\typescript\DockerFile"

# Build C++/C#
build_image "cpp" "D:\Vscode\Project_folder\ZephyrV2\prototyping\compiler-concept-next\backend\docker\cpp\Dockerfile"
build_image "csharp" "D:\Vscode\Project_folder\ZephyrV2\prototyping\compiler-concept-next\backend\docker\csharp\Dockerfile"

# Buuild Zig
build_image "csharp" "D:\Vscode\Project_folder\ZephyrV2\prototyping\compiler-concept-next\backend\docker\zig\Dockerfile"


# Build Rust image
build_image "rust" "D:\Vscode\Project_folder\ZephyrV2\prototyping\compiler-concept-next\backend\docker\rust\DockerFIle"

echo "All compiler images built successfully!"

# List all built images
echo -e "\nVerifying built images:"
docker images | grep compiler-
