// src/config.rs
use serde::Deserialize;
use std::time::Duration;

#[derive(Debug, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub docker: DockerConfig,
    pub redis: RedisConfig,
}

#[derive(Debug, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
}

#[derive(Debug, Deserialize)]
pub struct DockerConfig {
    pub max_memory: u64,
    pub cpu_quota: i64,
    pub execution_timeout: Duration,
    pub max_container_pool_size: usize,
}

#[derive(Debug, Deserialize)]
pub struct RedisConfig {
    pub url: String,
    pub cache_ttl: Duration,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            server: ServerConfig {
                host: "127.0.0.1".to_string(),
                port: 8080,
            },
            docker: DockerConfig {
                max_memory: 512 * 1024 * 1024, // 512MB
                cpu_quota: 50000,              // 50% CPU
                execution_timeout: Duration::from_secs(10),
                max_container_pool_size: 10,
            },
            redis: RedisConfig {
                url: "redis://127.0.0.1:6379".to_string(),
                cache_ttl: Duration::from_secs(3600),
            },
        }
    }
}
