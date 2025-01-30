terraform {
  required_version = ">= 1.0.0"

  backend "s3" {
    bucket = "zephyr-terraform-state"
    key    = "terraform.tfstate"
    region = "us-west-2"
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
  }
}

module "vpc" {
  source = "./modules/vpc"
  # Variables will be defined in terraform.tfvars
}

module "eks" {
  source = "./modules/eks"
  # Variables will be defined in terraform.tfvars
}

module "rds" {
  source = "./modules/rds"
  # Variables will be defined in terraform.tfvars
}
