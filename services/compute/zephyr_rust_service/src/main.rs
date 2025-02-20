// src/main.rs
mod ipc;
mod ai;
// mod utils;

use anyhow::Result;
use dotenv::dotenv;
use std::env;
use crate::ipc::phoenix::PhoenixIPC;
use crate::ai::gemini::GeminiProvider;
use crate::ai::AIProvider;

#[tokio::main]
async fn main() -> Result<()> {
    // Load environment variables
    dotenv().ok();

    let gemini = GeminiProvider::new()?;

    // Test the API
    let response = gemini.process_message("Hello!").await?;
    println!("Gemini response: {}", response);

    // Initialize tracing
    tracing_subscriber::fmt::init();

    // Get IPC address from environment
    let ipc_address = env::var("IPC_ADDRESS")
        .unwrap_or_else(|_| "tcp://127.0.0.1:5555".to_string());

    println!("Starting Zephyr Rust Service");
    println!("IPC Address: {}", ipc_address);

    // Create and start IPC service
    let ipc = PhoenixIPC::new(&ipc_address).await?;
    ipc.start().await?;

    Ok(())
}
