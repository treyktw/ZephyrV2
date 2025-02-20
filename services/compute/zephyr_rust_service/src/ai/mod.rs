// src/ai/mod.rs
pub mod gemini;

use anyhow::Result;
use async_trait::async_trait;

#[async_trait]
pub trait AIProvider: Send + Sync {
    /// Process a message and return the complete response
    async fn process_message(&self, content: &str) -> Result<String>;

    /// Stream the response, calling the callback with each chunk of text
    /// The callback will be called multiple times as text becomes available
    async fn stream_response<F>(&self, content: &str, callback: F) -> Result<()>
    where
        F: FnMut(String) + Send + 'static;
}
