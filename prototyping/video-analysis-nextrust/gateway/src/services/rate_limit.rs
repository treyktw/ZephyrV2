// src/services/rate_limit.rs
use redis::AsyncCommands;
use crate::error::AppError;

pub struct RateLimiter {
    redis_url: String,
    max_requests_per_minute: u32,
    max_uploads_per_hour: u32,
    max_file_size: usize,
}

impl RateLimiter {
    pub fn new(redis_url: String) -> Self {
        Self {
            redis_url,
            max_requests_per_minute: 60,
            max_uploads_per_hour: 100,
            max_file_size: 2 * 1024 * 1024 * 1024, // 2GB
        }
    }

    pub async fn check_rate_limit(&self, ip: &str, limit_type: &str) -> Result<(), AppError> {
        let client = redis::Client::open(self.redis_url.clone())
            .map_err(|e| AppError::InternalError(anyhow::Error::from(e)))?;

        let mut conn = client.get_async_connection().await
            .map_err(|e| AppError::InternalError(anyhow::Error::from(e)))?;

        match limit_type {
            "request" => {
                let key = format!("rate:{}:requests", ip);
                let count: Option<u32> = conn.get(&key).await
                    .map_err(|e| AppError::InternalError(anyhow::Error::from(e)))?;

                match count {
                    Some(c) if c >= self.max_requests_per_minute => {
                        Err(AppError::RateLimitExceeded(
                            "Too many requests. Please try again in a minute.".to_string()
                        ))
                    },
                    _ => {
                        let _: () = conn.incr(&key, 1_i32).await
                            .map_err(|e| AppError::InternalError(anyhow::Error::from(e)))?;
                        let _: () = conn.expire(&key, 60).await
                            .map_err(|e| AppError::InternalError(anyhow::Error::from(e)))?;
                        Ok(())
                    }
                }
            },
            "upload" => {
                let key = format!("rate:{}:uploads", ip);
                let count: Option<u32> = conn.get(&key).await
                    .map_err(|e| AppError::InternalError(anyhow::Error::from(e)))?;

                match count {
                    Some(c) if c >= self.max_uploads_per_hour => {
                        Err(AppError::RateLimitExceeded(
                            "Upload limit reached. Please try again later.".to_string()
                        ))
                    },
                    _ => {
                        let _: () = conn.incr(&key, 1_i32).await
                            .map_err(|e| AppError::InternalError(anyhow::Error::from(e)))?;
                        let _: () = conn.expire(&key, 3600).await
                            .map_err(|e| AppError::InternalError(anyhow::Error::from(e)))?;
                        Ok(())
                    }
                }
            },
            _ => Ok(()),
        }
    }

    pub fn check_file_size(&self, size: usize) -> Result<(), AppError> {
        if size > self.max_file_size {
            Err(AppError::InvalidInput(
                format!("File size exceeds maximum allowed size of {}GB", self.max_file_size / 1024 / 1024 / 1024)
            ))
        } else {
            Ok(())
        }
    }
}
