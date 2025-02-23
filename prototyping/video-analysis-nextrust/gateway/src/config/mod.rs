use std::path::PathBuf;

use anyhow::{Context, Result};
use sqlx::MySqlPool;

pub struct Config {
    pub port: u16,
    pub redis_url: String,
    pub upload_dir: PathBuf,
    pub allowed_origins: Vec<String>,
    pub singlestore: SingleStoreConfig, // Add this
}

pub struct SingleStoreConfig {
    pub url: String,
    pub pool_max_connections: u32,
}

impl SingleStoreConfig {
    pub async fn validate_connection(&self) -> Result<()> {
        let pool = MySqlPool::connect(&self.url)
            .await
            .context("Failed to connect to SingleStore")?;

        // Test query
        sqlx::query("SELECT 1")
            .fetch_one(&pool)
            .await
            .context("Failed to execute test query")?;

        Ok(())
    }

    pub fn validate(&self) -> Result<()> {
        if self.pool_max_connections == 0 {
            anyhow::bail!("Pool max connections must be greater than 0");
        }
        // Validate URL format
        if !self.url.starts_with("mysql://") {
            anyhow::bail!("Invalid SingleStore URL format");
        }
        Ok(())
    }
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        dotenv::dotenv().ok();

        let project_root = std::env::current_dir()?
            .parent()
            .ok_or_else(|| anyhow::anyhow!("Failed to get parent directory"))?
            .to_path_buf();

        // Build SingleStore URL from components or use full URL from env
        let singlestore_url = std::env::var("SINGLESTORE_URL").unwrap_or_else(|_| {
            format!(
                "mysql://{}:{}@{}:{}/{}",
                std::env::var("SINGLESTORE_USER").unwrap_or_else(|_| "root".to_string()),
                std::env::var("SINGLESTORE_PASSWORD").unwrap_or_else(|_| "password".to_string()),
                std::env::var("SINGLESTORE_HOST").unwrap_or_else(|_| "127.0.0.1".to_string()),
                std::env::var("SINGLESTORE_PORT").unwrap_or_else(|_| "3306".to_string()),
                std::env::var("SINGLESTORE_DATABASE")
                    .unwrap_or_else(|_| "video_analysis".to_string()),
            )
        });

        Ok(Config {
            port: std::env::var("PORT")
                .unwrap_or_else(|_| "8000".to_string())
                .parse()?,
            redis_url: std::env::var("REDIS_URL")
                .unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string()),
            upload_dir: project_root.join("data").join("videos"),
            allowed_origins: std::env::var("ALLOWED_ORIGINS")
                .unwrap_or_else(|_| "http://localhost:3000".to_string())
                .split(',')
                .map(String::from)
                .collect(),
            singlestore: SingleStoreConfig {
                url: singlestore_url,
                pool_max_connections: std::env::var("SINGLESTORE_POOL_MAX_CONNECTIONS")
                    .unwrap_or_else(|_| "10".to_string())
                    .parse()
                    .unwrap_or(10),
            },
        })
    }

    pub fn validate(&self) -> Result<()> {
        // Validate port
        if self.port == 0 {
            anyhow::bail!("Port cannot be 0");
        }

        // Validate Redis URL
        if !self.redis_url.starts_with("redis://") {
            anyhow::bail!("Invalid Redis URL format");
        }

        // Validate upload directory
        if self.upload_dir.as_os_str().is_empty() {
            anyhow::bail!("Upload directory path cannot be empty");
        }

        // Validate SingleStore config
        self.singlestore.validate()?;

        Ok(())
    }

    pub async fn test_connections(&self) -> Result<()> {
        // Test Redis connection
        let redis_client =
            redis::Client::open(self.redis_url.clone()).context("Failed to create Redis client")?;
        let mut redis_conn = redis_client
            .get_async_connection()
            .await
            .context("Failed to connect to Redis")?;

        redis::cmd("PING")
            .query_async::<_, ()>(&mut redis_conn)
            .await
            .context("Failed to ping Redis")?;

        // Test SingleStore connection
        self.singlestore.validate_connection().await?;

        Ok(())
    }
}
