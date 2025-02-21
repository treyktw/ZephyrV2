use std::{path::PathBuf, sync::Arc};

use actix_cors::Cors;
use actix_web::{middleware::Logger, web, App, HttpServer};
use services::{archive::ArchiveService, rate_limit::RateLimiter, redis::RedisPool};
use std::time::Duration;

mod config;
mod error;
mod handlers;
mod middleware;
mod models;
mod services;

async fn run_archive_check(archive_service: Arc<ArchiveService>) {
    loop {
        if let Err(e) = archive_service.check_and_archive_videos().await {
            log::error!("Error checking archives: {}", e);
        }
        tokio::time::sleep(Duration::from_secs_f64(32000.0)).await;
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));

    let config = config::Config::from_env().expect("Failed to load configuration");

    // Create data directories if they don't exist
    for dir in &["data/videos", "data/frames"] {
        std::fs::create_dir_all(dir).expect("Failed to create data directory");
    }

    println!("Upload directory: {}", config.upload_dir.display());

    // Initialize video service with both Redis URL and upload directory
    let video_service = web::Data::new(
        services::video::VideoService::new(
            config.redis_url.clone(),
            config.upload_dir.clone(), // Clone the PathBuf before moving
        )
        .expect("Failed to create video service"),
    );

    println!("Starting server on port {}", config.port);
    println!("Upload directory: {}", config.upload_dir.display());
    println!("Redis URL: {}", config.redis_url);

    let redis_pool =
        Arc::new(RedisPool::new(&config.redis_url, 10).expect("Failed to create Redis pool"));
    let archive_service = Arc::new(ArchiveService::new(
        config.redis_url.clone(),
        30,
        PathBuf::from("archives"),
        redis_pool.clone(),
    ));

    let archive_service_clone = archive_service.clone();
    tokio::spawn(async move {
        run_archive_check(archive_service_clone).await;
    });

    let allowed_origins = config.allowed_origins.clone();

    let rate_limiter = web::Data::new(RateLimiter::new(config.redis_url.clone()));

    HttpServer::new(move || {
        let allowed_origins = allowed_origins.clone();
        let cors = Cors::default()
            .allowed_origin_fn(move |origin, _req_head| {
                allowed_origins
                    .iter()
                    .any(|allowed| origin.as_bytes().starts_with(allowed.as_bytes()))
            })
            .allowed_methods(vec!["GET", "POST", "PUT", "DELETE"])
            .allowed_headers(vec!["Content-Type", "Authorization"])
            .max_age(3600);

        App::new()
            .wrap(cors)
            .wrap(Logger::default())
            .app_data(video_service.clone())
            .app_data(rate_limiter.clone()) // Add rate limiter to app data
            .wrap(middleware::rate_limit::RateLimitMiddleware::default()) // Add rate limit middleware
            .service(
                web::scope("/api")
                    .service(handlers::health::health_check)
                    .service(handlers::video::upload_video)
                    .service(handlers::video::archive_video) // Add archive endpoint
                    .service(handlers::video::restore_video) // Add restore endpoint
                    .service(handlers::vector::search_vectors)
                    .service(handlers::vector::index_vector)
                    .service(handlers::vector::get_vector)
                    .service(handlers::vector::batch_index_vectors),
            )
    })
    .bind(("127.0.0.1", config.port))?
    .run()
    .await
}
