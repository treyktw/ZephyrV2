// src/ai/gemini.rs
use super::AIProvider;
use anyhow::Result;
use async_trait::async_trait;
use serde_json::json;
use dotenv::dotenv;
use serde_json::Value;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct GeminiProvider {
    api_key: String,
    base_url: String,
}

#[async_trait]
impl AIProvider for GeminiProvider {
    async fn stream_response<F>(&self, content: &str, mut callback: F) -> Result<()>
    where
        F: FnMut(String) + Send + 'static,
    {
        let client = reqwest::Client::new();
        let url = format!("{}{}", self.base_url, self.api_key);

        let request_body = json!({
            "contents": [{
                "parts": [{
                    "text": content
                }]
            }],
            "generationConfig": {
                "temperature": 0.7,
                "topK": 40,
                "topP": 0.95,
                "maxOutputTokens": 2048,
            }
        });

        println!("🔄 Making request to Gemini");

        let response = client
            .post(&url)
            .json(&request_body)
            .send()
            .await?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await?;
            println!("❌ Gemini API error: {} - {}", status, error_text);
            return Err(anyhow::anyhow!("API request failed: {}", error_text));
        }

        let response_text = response.text().await?;
        println!("📝 Full Gemini response: {}", response_text);

        if let Ok(json) = serde_json::from_str::<Value>(&response_text) {
            if let Some(candidates) = json["candidates"].as_array() {
                if let Some(first_candidate) = candidates.first() {
                    if let Some(text) = first_candidate["content"]["parts"][0]["text"].as_str() {
                        println!("✨ Processing Gemini response: {}", text);

                        // Create a buffer for accumulating words
                        let mut word_buffer = String::new();

                        for c in text.chars() {
                            word_buffer.push(c);

                            // If we hit a word boundary (space or punctuation), send the token
                            if c.is_whitespace() || c.is_ascii_punctuation() {
                                if !word_buffer.is_empty() {
                                    println!("🔤 Sending token: {}", word_buffer);
                                    callback(word_buffer.clone());
                                    word_buffer.clear();
                                }
                            }
                        }

                        // Send any remaining content in the buffer
                        if !word_buffer.is_empty() {
                            println!("🔤 Sending final token: {}", word_buffer);
                            callback(word_buffer);
                        }

                        println!("✅ Finished processing Gemini response");
                    } else {
                        println!("❌ No text found in response parts");
                        return Err(anyhow::anyhow!("No text found in response parts"));
                    }
                } else {
                    println!("❌ No candidates found in response");
                    return Err(anyhow::anyhow!("No candidates found in response"));
                }
            }
        }

        Ok(())
    }

    async fn process_message(&self, content: &str) -> Result<String> {
        let client = reqwest::Client::new();
        let url = format!("{}{}", self.base_url, self.api_key);

        let request_body = json!({
            "contents": [{
                "parts": [{
                    "text": content
                }]
            }],
            "generationConfig": {
                "temperature": 0.7,
                "topK": 40,
                "topP": 0.95,
                "maxOutputTokens": 2048,
            }
        });

        let response = client
            .post(&url)
            .json(&request_body)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow::anyhow!("API request failed: {}", error_text));
        }

        let response_text = response.text().await?;
        Ok(response_text)
    }
}

impl GeminiProvider {
    pub fn new() -> Result<Self> {
        dotenv().ok();
        let api_key = std::env::var("GEMINI_API_KEY")
            .expect("GEMINI_API_KEY must be set");

        Ok(Self {
            api_key,
            base_url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=".to_string(),
        })
    }
}
