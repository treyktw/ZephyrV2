use std::{io::Write, sync::Arc};
// src/services/archive.rs
use anyhow::Result;
use chrono::{DateTime, Utc};
use redis::AsyncCommands;
use serde_json::json;
use std::path::{Path, PathBuf};
use zip::write::FileOptions;

use crate::{error::AppError, models::video::Video};

use super::redis::RedisPool;

pub struct ArchiveService {
    redis_url: String,
    archive_after_days: u64, // Days of inactivity before archiving
    archive_dir: PathBuf,    // Where to store archives
    redis_pool: Arc<RedisPool>,
}

impl ArchiveService {
    pub fn new(
        redis_url: String,
        archive_after_days: u64,
        archive_dir: PathBuf,
        redis_pool: Arc<RedisPool>,
    ) -> Self {
        Self {
            redis_url,
            archive_after_days,
            archive_dir,
            redis_pool,
        }
    }

    pub async fn check_and_archive_videos(&self) -> Result<()> {
        let client = redis::Client::open(self.redis_url.clone())?;
        let mut conn = client.get_async_connection().await?;

        // Get all video keys
        let video_keys: Vec<String> = conn.keys("video:*").await?;

        for key in video_keys {
            let video_json: String = conn.get(&key).await?;
            let video: Video = serde_json::from_str(&video_json)?;

            // Check last access time from Redis
            let last_access: Option<i64> =
                conn.get(format!("video:{}:last_access", video.id)).await?;

            if let Some(last_access) = last_access {
                let last_access =
                    DateTime::from_timestamp(last_access, 0).unwrap_or_else(|| Utc::now());

                let days_since_access = (Utc::now() - last_access).num_days();

                if days_since_access > self.archive_after_days as i64 {
                    self.archive_video(&video).await?;
                }
            }
        }

        Ok(())
    }

    pub async fn archive_video(&self, video: &Video) -> Result<(), AppError> {
        let mut conn = self
            .redis_pool
            .get_conn()
            .await
            .map_err(|e| AppError::InternalError(e))?;

        // Create archive path
        let archive_path = self.archive_dir.join(format!("archive_{}.zip", video.id));

        // Create zip archive
        let file =
            std::fs::File::create(&archive_path).map_err(|e| AppError::InternalError(e.into()))?;
        let mut zip = zip::ZipWriter::new(file);
        let options = FileOptions::<'_, ()>::default().compression_method(zip::CompressionMethod::Stored);

        // Get the video path from video metadata
        let archive_path_str = video.archive_path.clone().unwrap_or_default();
        let video_path = Path::new(&archive_path_str);

        // Archive original video
        if video_path.exists() {
            zip.start_file("original.mp4", options)
                .map_err(|e| AppError::InternalError(e.into()))?;
            let data = std::fs::read(video_path).map_err(|e| AppError::InternalError(e.into()))?;
            zip.write_all(&data)
                .map_err(|e| AppError::InternalError(e.into()))?;
        }

        // Archive frames if they exist
        let frames_dir = video_path.parent().unwrap().join("frames");
        if frames_dir.exists() {
            for entry in
                std::fs::read_dir(frames_dir).map_err(|e| AppError::InternalError(e.into()))?
            {
                let entry = entry.map_err(|e| AppError::InternalError(e.into()))?;
                if entry.path().is_file() {
                    let rel_path = format!("frames/{}", entry.file_name().to_string_lossy());
                    zip.start_file(&rel_path, options)
                        .map_err(|e| AppError::InternalError(e.into()))?;
                    let data = std::fs::read(entry.path())
                        .map_err(|e| AppError::InternalError(e.into()))?;
                    zip.write_all(&data)
                        .map_err(|e| AppError::InternalError(e.into()))?;
                }
            }
        }

        zip.finish()
            .map_err(|e| AppError::InternalError(e.into()))?;

        // Update Redis with archive metadata
        let archive_metadata = json!({
            "archived": true,
            "archive_path": archive_path.to_string_lossy().to_string(),
            "archive_date": chrono::Utc::now().timestamp(),
            "original_path": video_path.to_string_lossy().to_string()
        });

        redis::pipe()
            .atomic()
            .cmd("HSET")
            .arg(format!("video:{}", video.id))
            .arg("archive_metadata")
            .arg(archive_metadata.to_string())
            .cmd("HSET")
            .arg(format!("video:{}", video.id))
            .arg("status")
            .arg("archived")
            .query_async::<_, ()>(&mut conn)
            .await
            .map_err(|e| AppError::InternalError(e.into()))?;

        Ok(())
    }

    // Function to restore from archive if needed
    pub async fn restore_from_archive(&self, video_id: &str) -> Result<(), AppError> {
        let mut conn = self
            .redis_pool
            .get_conn()
            .await
            .map_err(|e| AppError::InternalError(e))?;

        // Get archive metadata
        let archive_metadata: String = redis::cmd("HGET")
            .arg(format!("video:{}", video_id))
            .arg("archive_metadata")
            .query_async(&mut conn)
            .await
            .map_err(|e| AppError::InternalError(e.into()))?;

        let metadata: serde_json::Value = serde_json::from_str(&archive_metadata)
            .map_err(|e| AppError::InternalError(e.into()))?;

        let archive_path = metadata["archive_path"]
            .as_str()
            .ok_or_else(|| AppError::NotFound("Archive path not found".to_string()))?;
        let original_path = metadata["original_path"]
            .as_str()
            .ok_or_else(|| AppError::NotFound("Original path not found".to_string()))?;

        // Extract archive
        let file =
            std::fs::File::open(archive_path).map_err(|e| AppError::InternalError(e.into()))?;
        let mut archive =
            zip::ZipArchive::new(file).map_err(|e| AppError::InternalError(e.into()))?;

        // Create original directory if it doesn't exist
        std::fs::create_dir_all(original_path).map_err(|e| AppError::InternalError(e.into()))?;

        // Extract to original location
        archive
            .extract(Path::new(original_path))
            .map_err(|e| AppError::InternalError(e.into()))?;

        // Update Redis
        redis::pipe()
            .atomic()
            .cmd("HDEL")
            .arg(format!("video:{}", video_id))
            .arg("archive_metadata")
            .cmd("HSET")
            .arg(format!("video:{}", video_id))
            .arg("status")
            .arg("restored")
            .query_async::<_, ()>(&mut conn)
            .await
            .map_err(|e| AppError::InternalError(e.into()))?;

        Ok(())
    }
}
