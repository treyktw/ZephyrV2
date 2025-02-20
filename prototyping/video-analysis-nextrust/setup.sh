# setup.sh
#!/bin/bash

# Create necessary directories
mkdir -p data/{videos,frames}
chmod -R 777 data

# Create .env files
echo "REDIS_URL=redis://redis:6379
UPLOAD_DIR=/data/videos" > backend/gateway/.env

echo "REDIS_URL=redis://redis:6379
UPLOAD_DIR=/data/videos
FRAMES_DIR=/data/frames" > backend/go-processing/.env

echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api" > frontend/.env.local

# Start development environment
docker-compose -f docker/development/docker-compose.yml down

# Start development environment
docker-compose -f docker/development/docker-compose.yml up --build
