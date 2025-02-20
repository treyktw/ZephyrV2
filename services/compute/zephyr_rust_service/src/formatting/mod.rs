// src/formatting/mod.rs
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Serialize, Deserialize)]
pub struct FormattedMessage {
    pub text: String,
    pub message_type: MessageType,
    pub metadata: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageType {
    Text,
    Code,
    Error,
    System,
}

pub fn format_ai_response(text: &str) -> FormattedMessage {
    // Check if the text contains code blocks
    if text.contains("```") {
        FormattedMessage {
            text: text.to_string(),
            message_type: MessageType::Code,
            metadata: Some(json!({
                "has_code": true,
                "length": text.len()
            }))
        }
    } else {
        FormattedMessage {
            text: text.to_string(),
            message_type: MessageType::Text,
            metadata: Some(json!({
                "length": text.len()
            }))
        }
    }
}

// Add streaming support
pub struct MessageStream {
    buffer: String,
    chunk_size: usize,
}

impl MessageStream {
    pub fn new(chunk_size: usize) -> Self {
        Self {
            buffer: String::new(),
            chunk_size,
        }
    }

    pub fn add_content(&mut self, content: &str) -> Vec<FormattedMessage> {
        self.buffer.push_str(content);

        let mut messages = Vec::new();

        // Process complete chunks
        while self.buffer.len() >= self.chunk_size {
            let chunk = self.buffer.drain(..self.chunk_size).collect::<String>();
            messages.push(FormattedMessage {
                text: chunk,
                message_type: MessageType::Text,
                metadata: Some(json!({ "streaming": true }))
            });
        }

        messages
    }

    pub fn flush(&mut self) -> Option<FormattedMessage> {
        if self.buffer.is_empty() {
            return None;
        }

        let remaining = self.buffer.drain(..).collect::<String>();
        Some(FormattedMessage {
            text: remaining,
            message_type: MessageType::Text,
            metadata: Some(json!({ "streaming": true, "final": true }))
        })
    }
}
