// src/handlers/vector.rs
use actix_web::{get, post, web, HttpResponse};
use crate::error::AppError;
use crate::services::indexing::VectorIndexService;
use crate::services::search::VectorSearchService;

use crate::models::vector::{Vector, VectorSearchQuery};
use log::info;
use serde_json::json;

#[post("/vectors/search")]
pub async fn search_vectors(
    query: web::Json<VectorSearchQuery>,
    search_service: web::Data<VectorSearchService>,
) -> Result<HttpResponse, AppError> {
    info!("Starting vector search...");
    let results = search_service.search(query.into_inner()).await?;
    Ok(HttpResponse::Ok().json(results))
}

#[post("/vectors")]
pub async fn index_vector(
    vector: web::Json<Vector>,
    index_service: web::Data<VectorIndexService>,
) -> Result<HttpResponse, AppError> {
    info!("Indexing vector...");
    let vector_id = vector.id.clone();
    index_service.index_vector(vector.into_inner()).await?;
    Ok(HttpResponse::Ok().json(json!({
        "message": "Vector indexed successfully",
        "vector_id": vector_id
    })))
}

#[get("/vectors/{id}")]
pub async fn get_vector(
    id: web::Path<String>,
    index_service: web::Data<VectorIndexService>,
) -> Result<HttpResponse, AppError> {
    info!("Retrieving vector: {}", id);

    match index_service.get_vector(&id).await? {
        Some(vector) => {
            // Return vector with additional metadata
            Ok(HttpResponse::Ok().json(json!({
                "status": "success",
                "data": {
                    "vector": vector,
                    "metadata": {
                        "dimension": vector.embedding.len(),
                        "retrieved_at": chrono::Utc::now().timestamp()
                    }
                }
            })))
        }
        None => Err(AppError::NotFound(format!("Vector not found: {}", id)))
    }
}

#[post("/vectors/batch")]
pub async fn batch_index_vectors(
    vectors: web::Json<Vec<Vector>>,
    index_service: web::Data<VectorIndexService>,
) -> Result<HttpResponse, AppError> {
    info!("Starting batch vector indexing...");
    let count = vectors.len();
    index_service.batch_index_vectors(vectors.into_inner()).await?;
    Ok(HttpResponse::Ok().json(json!({
        "message": "Vectors batch indexed successfully",
        "count": count
    })))
}
