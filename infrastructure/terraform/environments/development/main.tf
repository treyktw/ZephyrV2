module "zephyr" {
  source = "../../"
  
  environment = "development"
  
  vpc_cidr = "10.0.0.0/16"
  
  eks_cluster_name = "zephyr-dev"
  eks_node_count   = 2
  eks_node_type    = "t3.medium"
  
  rds_instance_class = "db.t3.medium"
}
