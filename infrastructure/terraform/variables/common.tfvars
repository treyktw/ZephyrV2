region = "us-west-2"

tags = {
  Project     = "ZephyrV2"
  ManagedBy   = "Terraform"
}

vpc_cidr = "10.0.0.0/16"

availability_zones = [
  "us-west-2a",
  "us-west-2b",
  "us-west-2c"
]
