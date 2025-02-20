// rust-gateway/src/config/mod.rs
use std::path::PathBuf;

pub struct Config {
    pub port: u16,
    pub redis_url: String,
    pub upload_dir: PathBuf,
    pub allowed_origins: Vec<String>,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        dotenv::dotenv().ok();

        // Get the project root directory (two levels up from current dir)
        let project_root = std::env::current_dir()?
            .parent()
            .ok_or_else(|| anyhow::anyhow!("Failed to get parent directory"))?
            .to_path_buf();

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
        })
    }
}
