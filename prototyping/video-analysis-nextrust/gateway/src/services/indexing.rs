// src/services/vector/indexing.rs
use crate::error::AppError;
use crate::models::vector::Vector;
use sqlx::mysql::MySqlPool;
use sqlx::Row;
use std::sync::Arc;

#[derive(Clone)]
pub struct VectorIndexService {
    db: Arc<MySqlPool>,
}

impl VectorIndexService {
    pub fn new(db: Arc<MySqlPool>) -> Self {
        Self { db }
    }

    // Add the vector_to_bytes method
    fn vector_to_bytes(&self, vector: &[f32]) -> Result<Vec<u8>, AppError> {
        let mut bytes = Vec::with_capacity(vector.len() * 4);
        for &value in vector {
            bytes.extend_from_slice(&value.to_le_bytes());
        }
        Ok(bytes)
    }

    pub async fn get_vector(&self, frame_id: &str) -> Result<Option<Vector>, AppError> {
        let query = "
            SELECT
                frame_id as id,
                vector as embedding,
                metadata,
                created_at
            FROM frame_vectors
            WHERE frame_id = ?";

        let row = sqlx::query(query)
            .bind(frame_id)
            .fetch_optional(&*self.db)
            .await
            .map_err(|e| AppError::Database(e))?;

        match row {
            Some(row) => {
                let id: String = row.try_get("id")?;
                let embedding: Vec<u8> = row.try_get("embedding")?;
                let metadata: Option<serde_json::Value> = row.try_get("metadata")?;
                let created_at: chrono::DateTime<chrono::Utc> = row.try_get("created_at")?;

                // Convert the binary embedding back to Vec<f32>
                let embedding = self.bytes_to_vector(&embedding)?;
                let frame_id = id.clone();

                Ok(Some(Vector {
                    id,
                    frame_id,
                    embedding,
                    metadata,
                    created_at,
                }))
            }
            None => Ok(None),
        }
    }

    pub async fn index_vector(&self, vector: Vector) -> Result<(), AppError> {
        let vector_bytes = self
            .vector_to_bytes(&vector.embedding)
            .map_err(|e| AppError::VectorFormat(e.to_string()))?;

        // Convert metadata to JSON string
        let metadata_json = match vector.metadata {
            Some(metadata) => serde_json::to_string(&metadata).map_err(|e| AppError::Json(e))?,
            None => "null".to_string(),
        };

        sqlx::query(
            "INSERT INTO frame_vectors (frame_id, vector, metadata)
             VALUES (?, ?, JSON_PARSE(?))
             ON DUPLICATE KEY UPDATE
                vector = VALUES(vector),
                metadata = VALUES(metadata)",
        )
        .bind(&vector.frame_id)
        .bind(&vector_bytes)
        .bind(&metadata_json)
        .execute(&*self.db)
        .await
        .map_err(|e| AppError::Database(e))?;

        Ok(())
    }

    pub async fn batch_index_vectors(&self, vectors: Vec<Vector>) -> Result<(), AppError> {
        let mut tx = self.db.begin().await.map_err(|e| AppError::Database(e))?;

        for vector in vectors {
            let vector_bytes = self
                .vector_to_bytes(&vector.embedding)
                .map_err(|e| AppError::VectorFormat(e.to_string()))?;

            let metadata_json = match vector.metadata {
                Some(metadata) => {
                    serde_json::to_string(&metadata).map_err(|e| AppError::Json(e))?
                }
                None => "null".to_string(),
            };

            sqlx::query(
                "INSERT INTO frame_vectors (frame_id, vector, metadata)
                 VALUES (?, ?, JSON_PARSE(?))
                 ON DUPLICATE KEY UPDATE
                    vector = VALUES(vector),
                    metadata = VALUES(metadata)",
            )
            .bind(&vector.frame_id)
            .bind(&vector_bytes)
            .bind(&metadata_json)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Database(e))?;
        }

        tx.commit().await.map_err(|e| AppError::Database(e))?;

        Ok(())
    }

    fn bytes_to_vector(&self, bytes: &[u8]) -> Result<Vec<f32>, AppError> {
        if bytes.len() % 4 != 0 {
            return Err(AppError::VectorFormat("Invalid vector byte length".into()));
        }

        let mut vector = Vec::with_capacity(bytes.len() / 4);
        for chunk in bytes.chunks_exact(4) {
            if let Ok(chunk_array) = chunk.try_into() {
                let value = f32::from_le_bytes(chunk_array);
                vector.push(value);
            } else {
                return Err(AppError::VectorFormat("Failed to convert bytes to f32".into()));
            }
        }

        Ok(vector)
    }

}
