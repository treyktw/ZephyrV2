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

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Vector format error: {0}")]
    VectorFormat(String),

    #[error("Internal error: {0}")]
    Internal(String),

    #[error("Vector not found: {0}")]
    VectorNotFound(String),
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

impl From<String> for AppError {
    fn from(error: String) -> Self {
        AppError::Internal(error)
    }
}

// Implement conversion from &str to AppError
impl From<&str> for AppError {
    fn from(error: &str) -> Self {
        AppError::Internal(error.to_string())
    }
}

// If you need to convert from a custom error type
impl From<Vec<u8>> for AppError {
    fn from(_: Vec<u8>) -> Self {
        AppError::VectorFormat("Invalid vector format".to_string())
    }
}

impl ResponseError for AppError {
    fn error_response(&self) -> HttpResponse {
        match self {
            AppError::InternalError(_) => HttpResponse::InternalServerError().json(json!({
                "error": "Internal Server Error"
            })),
            AppError::NotFound(msg) => HttpResponse::NotFound().json(json!({
                "error": msg
            })),
            AppError::InvalidInput(msg) => HttpResponse::BadRequest().json(json!({
                "error": msg
            })),
            AppError::UploadError(msg) => HttpResponse::BadRequest().json(json!({
                "error": msg
            })),
            AppError::RateLimitExceeded(msg) => HttpResponse::BadRequest().json(json!({
                "error": msg
            })),
            AppError::Database(msg) => HttpResponse::InternalServerError().json(json!({
                "error": msg.to_string()
            })),
            AppError::Json(msg) => HttpResponse::BadRequest().json(json!({
                "error": msg.to_string()
            })),
            AppError::VectorFormat(msg) => HttpResponse::BadRequest().json(json!({
                "error": msg
            })),
            AppError::Internal(msg) => HttpResponse::InternalServerError().json(json!({
                "error": msg
            })),
            AppError::VectorNotFound(msg) => HttpResponse::NotFound().json(json!({
                "status": "error",
                "message": msg,
                "error_type": "not_found"
            })),
        }
    }
}
