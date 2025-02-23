// src/services/vector/search.rs
use crate::models::vector::{VectorSearchQuery, VectorSearchResult};
use crate::error::AppError;
use sqlx::MySqlPool;
use std::sync::Arc;

use sqlx::Row;

#[derive(Clone)]
pub struct VectorSearchService {
    db: Arc<MySqlPool>,
}

impl VectorSearchService {
    pub fn new(db: Arc<MySqlPool>) -> Self {
        Self { db }
    }

    pub async fn search(&self, query: VectorSearchQuery) -> Result<Vec<VectorSearchResult>, AppError> {
        let limit = i64::try_from(query.limit.unwrap_or(10))
            .map_err(|_| AppError::Internal("Limit value too large".to_string()))?;
        let threshold = query.threshold.unwrap_or(0.7);
        let vector_bytes = self.vector_to_bytes(&query.vector)?;

        // Build the base SQL query
        let mut sql = String::from(
            "SELECT
                f.id as frame_id,
                DOT_PRODUCT(fv.vector, ?) as similarity,
                f.metadata
            FROM frame_vectors fv
            JOIN frames f ON f.id = fv.frame_id
            WHERE DOT_PRODUCT(fv.vector, ?) >= ?"
        );

        // Add filters to SQL if present
        if let Some(ref filter) = query.filter {
            if filter.video_id.is_some() {
                sql.push_str(" AND f.video_id = ?");
            }
            if filter.time_range.is_some() {
                sql.push_str(" AND f.timestamp BETWEEN ? AND ?");
            }
        }

        sql.push_str(" ORDER BY similarity DESC LIMIT ?");

        // Create the query builder
        let mut query_builder = sqlx::query_as::<_, VectorSearchResult>(&sql)
            .bind(&vector_bytes)
            .bind(&vector_bytes)
            .bind(threshold);

        // Add filter bindings if present
        if let Some(filter) = query.filter {
            if let Some(video_id) = filter.video_id {
                query_builder = query_builder.bind(video_id);
            }
            if let Some(time_range) = filter.time_range {
                query_builder = query_builder
                    .bind(time_range.start)
                    .bind(time_range.end);
            }
        }

        // Add limit
        query_builder = query_builder.bind(limit);

        // Execute the query
        let results = query_builder
            .fetch_all(&*self.db)
            .await
            .map_err(|e| AppError::Database(e))?;

        Ok(results)
    }

    fn vector_to_bytes(&self, vector: &[f32]) -> Result<Vec<u8>, AppError> {
        let mut bytes = Vec::with_capacity(vector.len() * 4);
        for &value in vector {
            bytes.extend_from_slice(&value.to_le_bytes());
        }
        Ok(bytes)
    }
}

// Add FromRow implementation for VectorSearchResult
impl<'r> sqlx::FromRow<'r, sqlx::mysql::MySqlRow> for VectorSearchResult {
    fn from_row(row: &'r sqlx::mysql::MySqlRow) -> Result<Self, sqlx::Error> {
        Ok(VectorSearchResult {
            frame_id: row.try_get("frame_id")?,
            similarity: row.try_get("similarity")?,
            metadata: row.try_get("metadata")?,
        })
    }
}
