use actix_web::{get, web, HttpResponse, Responder};
use serde_json::json;
use sqlx::MySqlPool;

#[get("/health")]
pub async fn health_check() -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "timestamp": chrono::Utc::now().timestamp()
    }))
}

// In handlers/health.rs
#[get("/health/singlestore")]
pub async fn singlestore_health(db: web::Data<MySqlPool>) -> impl Responder {
    match sqlx::query("SELECT 1").fetch_one(&**db).await {
        Ok(_) => HttpResponse::Ok().json(json!({
            "status": "healthy",
            "database": "singlestore",
            "timestamp": chrono::Utc::now().timestamp()
        })),
        Err(e) => HttpResponse::ServiceUnavailable().json(json!({
            "status": "unhealthy",
            "database": "singlestore",
            "error": e.to_string()
        }))
    }
}
