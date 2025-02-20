use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Video {
    pub id: String,
    pub filename: String,
    pub status: VideoStatus,
    pub created_at: i64,
    pub updated_at: i64,
    pub error_message: Option<String>,
    pub metadata: Option<VideoMetadata>,
    pub archived: Option<bool>,
    pub archive_path: Option<String>,
}


#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VideoMetadata {
    pub duration: Option<String>,
    pub size: Option<u64>,
    pub format: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum VideoStatus {
    Uploading,
    Processing,
    Complete,
    Error,
}
