#!/bin/bash

# Check requirements
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed. Aborting." >&2; exit 1; }
command -v kubectl >/dev/null 2>&1 || { echo "kubectl is required but not installed. Aborting." >&2; exit 1; }
command -v terraform >/dev/null 2>&1 || { echo "Terraform is required but not installed. Aborting." >&2; exit 1; }

# Set environment
ENV=${1:-development}
if [[ "$ENV" != "development" && "$ENV" != "production" ]]; then
    echo "Environment must be either 'development' or 'production'"
    exit 1
fi

# Setup Docker
echo "Setting up Docker environment..."
docker-compose -f docker/$ENV/docker-compose.yml pull

# Setup Kubernetes
echo "Setting up Kubernetes environment..."
kubectl apply -k kubernetes/$ENV

# Setup Terraform
echo "Initializing Terraform..."
cd terraform/environments/$ENV
terraform init
terraform plan -var-file=../../variables/common.tfvars
terraform apply -var-file=../../variables/common.tfvars -auto-approve

echo "Infrastructure setup complete for $ENV environment"
