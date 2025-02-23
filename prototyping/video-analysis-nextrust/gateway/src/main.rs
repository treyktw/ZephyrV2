use std::{path::PathBuf, sync::Arc};

use actix_cors::Cors;
use actix_web::{middleware::Logger, web, App, HttpServer};
use anyhow::Context;
use services::{
    archive::ArchiveService, indexing::VectorIndexService, rate_limit::RateLimiter,
    redis::RedisPool, search::VectorSearchService,
};
use sqlx::MySqlPool;
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

   // Load and validate configuration
   let config = config::Config::from_env().expect("Failed to load configuration");

   // SingleStore logging and connection
   println!("SingleStore Configuration:");
   println!("URL: {}", config.singlestore.url);
   println!("Max Connections: {}", config.singlestore.pool_max_connections);

   config.validate()
       .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;

   println!("Testing connections...");
   config.test_connections()
       .await
       .context("Failed to test connections")
       .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
   println!("✓ All connections tested successfully");

   println!("Connecting to SingleStore...");
   let db_pool = MySqlPool::connect(&config.singlestore.url)
       .await
       .expect("Failed to connect to SingleStore");
   let db_pool = Arc::new(db_pool);
   println!("✓ Connected to SingleStore successfully");

   // Service initialization logging
   println!("Starting server on port {}", config.port);
   println!("Upload directory: {}", config.upload_dir.display());
   println!("Redis URL: {}", config.redis_url);

   // Initialize vector services
   println!("Initializing vector services...");
   let vector_search = VectorSearchService::new(db_pool.clone());
   let vector_index = VectorIndexService::new(db_pool.clone());
   println!("✓ Vector services initialized with SingleStore connection");

   // Initialize Redis and Archive services
   let redis_pool = Arc::new(
       RedisPool::new(&config.redis_url, 10)
           .expect("Failed to create Redis pool")
   );

   let archive_service = Arc::new(ArchiveService::new(
       config.redis_url.clone(),
       30,
       PathBuf::from("archives"),
       redis_pool.clone(),
   ));

   // Spawn archive check service
   let archive_service_clone = archive_service.clone();
   tokio::spawn(async move {
       run_archive_check(archive_service_clone).await;
   });

   // Initialize other services
   let allowed_origins = config.allowed_origins.clone();
   let rate_limiter = web::Data::new(RateLimiter::new(config.redis_url.clone()));

   // Create required directories
   for dir in &["data/videos", "data/frames"] {
       std::fs::create_dir_all(dir).expect("Failed to create data directory");
   }

   // Initialize video service
   let video_service = web::Data::new(
       services::video::VideoService::new(
           config.redis_url.clone(),
           config.upload_dir.clone(),
       )
       .expect("Failed to create video service"),
   );

   // Start HTTP server
   println!("Starting HTTP server...");
   HttpServer::new(move || {
       // Configure CORS
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

       // Configure app
       App::new()
           .wrap(cors)
           .wrap(Logger::default())
           // Add services
           .app_data(video_service.clone())
           .app_data(rate_limiter.clone())
           .app_data(web::Data::new(vector_search.clone()))
           .app_data(web::Data::new(vector_index.clone()))
           // Add middleware
           .wrap(middleware::rate_limit::RateLimitMiddleware::default())
           // Configure routes
           .service(
               web::scope("/api")
                   // Health check
                   .service(handlers::health::health_check)
                   // Video endpoints
                   .service(handlers::video::upload_video)
                   .service(handlers::video::archive_video)
                   .service(handlers::video::restore_video)
                   // Vector endpoints
                   .service(handlers::vector::search_vectors)
                   .service(handlers::vector::index_vector)
                   .service(handlers::vector::get_vector)
                   .service(handlers::vector::batch_index_vectors)
           )
   })
   .bind(("127.0.0.1", config.port))?
   .run()
   .await
}
