// src/services/video.rs
use crate::models::video::Video;
use crate::services::redis::RedisPool;
use crate::{error::AppError, models::video::VideoStatus};
use serde_json::json;
use std::path::PathBuf;
use std::sync::Arc;

use super::archive::ArchiveService;

pub struct VideoService {
    redis_pool: Arc<RedisPool>,
    pub archive_service: Arc<ArchiveService>,
    upload_dir: PathBuf,  // Add this field
}

impl VideoService {
    pub fn new(redis_url: String, upload_dir: PathBuf) -> Result<Self, AppError> {
        let redis_pool = Arc::new(RedisPool::new(&redis_url, 10)
            .map_err(|e| AppError::InternalError(e))?);

        let archive_service = Arc::new(ArchiveService::new(
            redis_url.clone(),
            30,
            upload_dir.clone(),
            redis_pool.clone(),
        ));

        Ok(Self {
            redis_pool,
            archive_service: archive_service.clone(),
            upload_dir,
        })
    }

    // Add getter for upload_dir
    pub fn get_upload_dir(&self) -> &PathBuf {
        &self.upload_dir
    }

    pub async fn get_video(&self, id: &str) -> Result<Option<Video>, AppError> {
        let mut conn = self
            .redis_pool
            .get_conn()
            .await
            .map_err(|e| AppError::InternalError(e))?;

        let video_json: Option<String> = redis::cmd("GET")
            .arg(format!("video:{}", id))
            .query_async(&mut conn)
            .await
            .map_err(|e| AppError::InternalError(e.into()))?;

        match video_json {
            Some(json) => {
                let video: Video =
                    serde_json::from_str(&json).map_err(|e| AppError::InternalError(e.into()))?;
                Ok(Some(video))
            }
            None => Ok(None),
        }
    }

    pub async fn queue_for_processing(&self, video_id: &str) -> Result<(), AppError> {
        let mut conn = self
            .redis_pool
            .get_conn()
            .await
            .map_err(|e| AppError::InternalError(e))?;

        // Push to the video queue (Go will be listening to this)
        redis::cmd("LPUSH")
            .arg("video_queue")
            .arg(video_id)
            .query_async::<_, ()>(&mut conn)
            .await
            .map_err(|e| AppError::InternalError(e.into()))?;

        // Update processing status
        if let Some(mut video) = self.get_video(video_id).await? {
            video.status = VideoStatus::Processing;
            video.updated_at = chrono::Utc::now().timestamp();
            self.save_video(&video).await?;
        }

        Ok(())
    }

    pub async fn save_video(&self, video: &Video) -> Result<(), AppError> {
        let mut conn = self
            .redis_pool
            .get_conn()
            .await
            .map_err(|e| AppError::InternalError(e))?;

        let video_json =
            serde_json::to_string(video).map_err(|e| AppError::InternalError(e.into()))?;

        // Transaction to update both the video data and processing status
        redis::pipe()
            .atomic()
            .cmd("SET")
            .arg(format!("video:{}", video.id))
            .arg(video_json)
            .cmd("SET")
            .arg(format!("video:{}:processing", video.id))
            .arg(
                json!({
                    "status": "active",
                    "progress": 0,
                    "frames_processed": 0,
                    "started_at": chrono::Utc::now().timestamp(),
                    "last_update": chrono::Utc::now().timestamp()
                })
                .to_string(),
            )
            .query_async::<_, ()>(&mut conn)
            .await
            .map_err(|e| AppError::InternalError(e.into()))?;

        Ok(())
    }

    // Add method to get processing status
    pub async fn get_processing_status(&self, video_id: &str) -> Result<Option<String>, AppError> {
        let mut conn = self
            .redis_pool
            .get_conn()
            .await
            .map_err(|e| AppError::InternalError(e))?;

        let status: Option<String> = redis::cmd("GET")
            .arg(format!("video:{}:processing", video_id))
            .query_async(&mut conn)
            .await
            .map_err(|e| AppError::InternalError(e.into()))?;

        Ok(status)
    }

    // Add getter for archive service
    pub fn get_archive_service(&self) -> Arc<ArchiveService> {
        self.archive_service.clone()
    }

    // add singlestore connection
}
