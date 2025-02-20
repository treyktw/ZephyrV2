// src/error.rs
use actix_multipart::MultipartError;
use actix_web::{error::ResponseError, HttpResponse};
use redis::RedisError;
use serde_json::json;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Internal Server Error")]
    InternalError(#[from] anyhow::Error),

    #[error("Not Found: {0}")]
    NotFound(String),

    #[error("Invalid Input: {0}")]
    InvalidInput(String),

    #[error("Upload Error: {0}")]
    UploadError(String),

    #[error("Rate limit exceeded: {0}")]
    RateLimitExceeded(String),


}

// Implement From<MultipartError> for AppError
impl From<MultipartError> for AppError {
    fn from(error: MultipartError) -> Self {
        AppError::UploadError(error.to_string())
    }
}

// Implement From<std::io::Error> for AppError
impl From<std::io::Error> for AppError {
    fn from(error: std::io::Error) -> Self {
        AppError::InternalError(anyhow::Error::from(error))
    }
}

impl From<RedisError> for AppError {
    fn from(error: RedisError) -> Self {
        AppError::InternalError(anyhow::Error::from(error))
    }
}

impl ResponseError for AppError {
    fn error_response(&self) -> HttpResponse {
        match self {
            AppError::InternalError(_) => {
                HttpResponse::InternalServerError().json(json!({
                    "error": "Internal Server Error"
                }))
            }
            AppError::NotFound(msg) => {
                HttpResponse::NotFound().json(json!({
                    "error": msg
                }))
            }
            AppError::InvalidInput(msg) => {
                HttpResponse::BadRequest().json(json!({
                    "error": msg
                }))
            }
            AppError::UploadError(msg) => {
                HttpResponse::BadRequest().json(json!({
                    "error": msg
                }))
            }
            AppError::RateLimitExceeded(msg) => {
                HttpResponse::BadRequest().json(json!({
                    "error": msg
                }))
            }
        }
    }
}
