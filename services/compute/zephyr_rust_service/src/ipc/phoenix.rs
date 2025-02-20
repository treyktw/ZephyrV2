// src/ipc/phoenix.rs
use chrono;
use anyhow::Result;
use std::sync::Arc;
use tokio::sync::Mutex;
use zeromq::{Socket, SocketRecv, SocketSend, ZmqMessage, PushSocket, PullSocket};
use serde_json::{json, Value};
use crate::ai::gemini::GeminiProvider;
use crate::ai::AIProvider;

pub struct PhoenixIPC {
    push_socket: Arc<Mutex<PushSocket>>,
    pull_socket: Arc<Mutex<PullSocket>>,
    ai_provider: Arc<GeminiProvider>,
}

impl PhoenixIPC {
    pub async fn new(address: &str) -> Result<Self> {
        let mut push_socket = PushSocket::new();
        let mut pull_socket = PullSocket::new();

        // Bind the sockets using proper TCP addresses
        push_socket.bind("tcp://127.0.0.1:5555").await?;
        pull_socket.bind("tcp://127.0.0.1:5556").await?;

        println!("✅ Bound push socket to tcp://127.0.0.1:5555");
        println!("✅ Bound pull socket to tcp://127.0.0.1:5556");

        let push_socket = Arc::new(Mutex::new(push_socket));
        let pull_socket = Arc::new(Mutex::new(pull_socket));
        let ai_provider = Arc::new(GeminiProvider::new()?);

        Ok(Self {
            push_socket,
            pull_socket,
            ai_provider,
        })
    }

    pub async fn start(&self) -> Result<()> {
        println!("🚀 Starting Rust IPC service...");

        loop {
            let msg = {
                let mut socket = self.pull_socket.lock().await;
                socket.recv().await?
            };

            if let Some(message_text) = msg.iter().next() {
                let message_str = String::from_utf8_lossy(message_text);
                println!("📥 Received message: {}", message_str);

                if let Ok(json_value) = serde_json::from_str::<Value>(&message_str) {
                    if let Some(content) = json_value.get("content").and_then(Value::as_str) {
                        let push_socket = Arc::clone(&self.push_socket);

                        let socket_clone = Arc::clone(&push_socket);
                        let mut stream_handler = move |token: String| {
                            let socket = Arc::clone(&socket_clone);
                            let response = json!({
                                "status": "stream",
                                "token": token,
                                "metadata": {
                                    "timestamp": chrono::Utc::now().to_rfc3339()
                                }
                            });

                            tokio::spawn(async move {
                                let mut socket_lock = socket.lock().await;
                                if let Err(e) = socket_lock.send(ZmqMessage::from(response.to_string())).await {
                                    println!("❌ Error sending token: {}", e);
                                }
                            });
                        };

                        match self.ai_provider.stream_response(content, stream_handler).await {
                            Ok(_) => {
                                let completion = json!({
                                    "status": "complete",
                                    "metadata": {
                                        "timestamp": chrono::Utc::now().to_rfc3339()
                                    }
                                });

                                let mut socket = push_socket.lock().await;
                                socket.send(ZmqMessage::from(completion.to_string())).await?;
                                println!("✅ Streaming complete");
                            }
                            Err(e) => {
                                println!("❌ Error processing message: {}", e);
                                let error_response = json!({
                                    "status": "error",
                                    "message": {
                                        "content": format!("Error: {}", e),
                                        "type": "error",
                                        "metadata": {
                                            "timestamp": chrono::Utc::now().to_rfc3339()
                                        }
                                    }
                                });

                                let mut socket = push_socket.lock().await;
                                socket.send(ZmqMessage::from(error_response.to_string())).await?;
                            }
                        }
                    }
                }
            }
        }
    }
}
