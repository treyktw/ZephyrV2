// src/ipc/mod.rs
pub mod phoenix;

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Debug, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub chat_id: String,
    pub content: String,
    pub message_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Response {
    pub message_id: String,
    pub content: String,
    pub status: String,
}

pub trait IPCHandler: Send + Sync {
    async fn handle_message(&self, message: Message) -> Result<Response>;
}
