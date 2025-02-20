// src/error.rs
use thiserror::Error;

#[derive(Error, Debug)]
pub enum CompilerError {
    #[error("Docker error: {0}")]
    DockerError(#[from] bollard::errors::Error),

    #[error("Redis error: {0}")]
    RedisError(#[from] redis::RedisError),

    #[error("Execution timeout")]
    ExecutionTimeout,

    #[error("Container creation failed: {0}")]
    ContainerCreationError(String),

    #[error("Code execution failed: {0}")]
    CodeExecutionError(String),

    #[error("Resource limit exceeded: {0}")]
    ResourceLimitExceeded(String),
}

pub type Result<T> = std::result::Result<T, CompilerError>;
