use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vector {
    pub id: String,
    pub frame_id: String,
    pub embedding: Vec<f32>,
    pub metadata: Option<serde_json::Value>,
    #[serde(with = "chrono::serde::ts_milliseconds")]
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VectorSearchQuery {
    pub vector: Vec<f32>,
    pub limit: Option<usize>,
    pub threshold: Option<f32>,
    pub filter: Option<VectorFilter>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VectorFilter {
    pub video_id: Option<String>,
    pub time_range: Option<TimeRange>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TimeRange {
    pub start: f64,
    pub end: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VectorSearchResult {
    pub frame_id: String,
    pub similarity: f32,
    pub metadata: Option<serde_json::Value>,
}
