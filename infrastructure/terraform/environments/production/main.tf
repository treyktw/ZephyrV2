module "zephyr" {
  source = "../../"
  
  environment = "production"
  
  vpc_cidr = "10.0.0.0/16"
  
  eks_cluster_name = "zephyr-prod"
  eks_node_count   = 3
  eks_node_type    = "t3.large"
  
  rds_instance_class = "db.r5.large"
}
