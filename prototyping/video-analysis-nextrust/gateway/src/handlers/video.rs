// src/handlers/video.rs
use actix_multipart::Multipart;
use actix_web::{get, post, web, HttpResponse};
use futures::TryStreamExt;
use log::info;
use serde_json::json;
use std::io::Write;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::video::{Video, VideoStatus};
use crate::services::rate_limit::RateLimiter;
use crate::services::video::VideoService;

#[post("/videos")]
pub async fn upload_video(
    mut payload: Multipart,
    video_service: web::Data<VideoService>,
    rate_limiter: web::Data<RateLimiter>,
) -> Result<HttpResponse, AppError> {
    info!("Starting file upload...");

    let upload_dir = video_service.get_ref().get_upload_dir();

    while let Some(mut field) = payload.try_next().await? {
        let content_disposition = field.content_disposition();

        let filename = content_disposition
            .get_filename()
            .ok_or_else(|| AppError::InvalidInput("No filename provided".to_string()))?
            .to_string();

        let video_id = Uuid::new_v4().to_string();
        let video_dir = upload_dir.join(&video_id);

        // Create directory for this video
        if !video_dir.exists() {
            std::fs::create_dir_all(&video_dir)?;
        }

        let filepath = video_dir.join("original.mp4");
        info!("Saving to: {}", filepath.display());

        let f = web::block(move || std::fs::File::create(&filepath))
            .await
            .map_err(|e| AppError::InternalError(anyhow::Error::from(e)))??;

        let mut total_size = 0;
        while let Some(chunk) = field.try_next().await? {
            total_size += chunk.len();
            rate_limiter.check_file_size(total_size)?;

            let mut f_clone = f.try_clone()?;
            web::block(move || f_clone.write_all(&chunk))
                .await
                .map_err(|e| AppError::InternalError(anyhow::Error::from(e)))??;
        }

        info!("File saved successfully. Total size: {} bytes", total_size);

        // Create metadata.json
        let metadata = serde_json::json!({
            "id": video_id,
            "filename": filename,
            "size": total_size,
            "created_at": chrono::Utc::now().timestamp(),
            "updated_at": chrono::Utc::now().timestamp()
        });

        let metadata_path = video_dir.join("metadata.json");
        std::fs::write(
            metadata_path,
            serde_json::to_string_pretty(&metadata).map_err(|e| AppError::InternalError(e.into()))?
        )?;

        let video = Video {
            id: video_id.clone(),
            filename,
            status: VideoStatus::Uploading,
            created_at: chrono::Utc::now().timestamp(),
            updated_at: chrono::Utc::now().timestamp(),
            metadata: None,
            error_message: None,
            archived: Some(false),
            archive_path: None,
        };

        video_service.save_video(&video).await?;
        video_service.queue_for_processing(&video.id).await?;

        return Ok(HttpResponse::Ok().json(video));
    }

    Err(AppError::InvalidInput("No file provided".to_string()))
}

// Add endpoints for archive management
#[post("/videos/{id}/archive")]
pub async fn archive_video(
    path: web::Path<String>,
    video_service: web::Data<VideoService>,
) -> Result<HttpResponse, AppError> {
    let id = path.into_inner();

    // Get reference to VideoService
    let video_service = video_service.get_ref();

    if let Some(video) = video_service.get_video(&id).await? {
        video_service
            .get_archive_service()
            .archive_video(&video)
            .await?;
        Ok(HttpResponse::Ok().json(json!({
            "message": "Video archived successfully",
            "video_id": id
        })))
    } else {
        Err(AppError::NotFound(format!("Video not found: {}", id)))
    }
}

#[post("/videos/{id}/restore")]
pub async fn restore_video(
    path: web::Path<String>,
    video_service: web::Data<VideoService>,
) -> Result<HttpResponse, AppError> {
    let id = path.into_inner(); // Extract String from Path
    video_service
        .archive_service
        .restore_from_archive(&id)
        .await?;
    Ok(HttpResponse::Ok().json(json!({
        "message": "Video restored successfully",
        "video_id": id
    })))
}

#[get("/videos/{id}/status")]
pub async fn get_video_status(
    id: web::Path<String>,
    video_service: web::Data<VideoService>,
) -> Result<HttpResponse, AppError> {
    let video_id = id.into_inner();

    // Get both video and processing status
    let video = video_service.get_ref().get_video(&video_id).await?;
    let processing_status = video_service
        .get_ref()
        .get_processing_status(&video_id)
        .await?;

    match (video, processing_status) {
        (Some(video), Some(status)) => Ok(HttpResponse::Ok().json(json!({
            "video": video,
            "processing": serde_json::from_str::<serde_json::Value>(&status)
                .unwrap_or_else(|_| json!({}))
        }))),
        (Some(video), None) => Ok(HttpResponse::Ok().json(json!({ "video": video }))),
        _ => Err(AppError::NotFound(format!("Video not found: {}", video_id))),
    }
}
