// internal/services/vector/storage.go

package vector

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"zephyrV2/internal/models"
)

type VectorStorage interface {
	StoreVector(ctx context.Context, id string, vector []float32) error
	BatchStore(ctx context.Context, vectors map[string][]float32) error
	FindSimilar(ctx context.Context, vector []float32, limit int) ([]string, error)
	GetVector(ctx context.Context, id string) ([]float32, error)
}

type SingleStoreVectorStorage struct {
	db *sql.DB
}

func NewSingleStoreVectorStorage(db *sql.DB) *SingleStoreVectorStorage {
	return &SingleStoreVectorStorage{db: db}
}

func (s *SingleStoreVectorStorage) StoreVector(ctx context.Context, id string, vector []float32, metadata map[string]interface{}) error {
	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	query := `
        INSERT INTO frame_vectors (frame_id, vector, metadata)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
            vector = VALUES(vector),
            metadata = VALUES(metadata)
    `

	if _, err := s.db.ExecContext(ctx, query, id, vector, metadataJSON); err != nil {
		return fmt.Errorf("failed to store vector: %w", err)
	}

	return nil
}

func (s *SingleStoreVectorStorage) GetVector(ctx context.Context, id string) ([]float32, error) {
	query := `
        SELECT vector
        FROM frame_vectors
        WHERE frame_id = ?
    `

	var vector []float32
	if err := s.db.QueryRowContext(ctx, query, id).Scan(&vector); err != nil {
		return nil, fmt.Errorf("failed to get vector: %w", err)
	}

	return vector, nil
}

func (s *SingleStoreVectorStorage) FindSimilar(ctx context.Context, vector []float32, limit int) ([]models.Frame, error) {
	query := `
        SELECT f.*,
               DOT_PRODUCT(fv.vector, ?) as similarity
        FROM frames f
        JOIN frame_vectors fv ON f.id = fv.frame_id
        ORDER BY similarity DESC
        LIMIT ?
    `

	rows, err := s.db.QueryContext(ctx, query, vector, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to find similar vectors: %w", err)
	}
	defer rows.Close()

	var frames []models.Frame
	for rows.Next() {
		var frame models.Frame
		if err := rows.Scan(
			&frame.ID,
			&frame.VideoID,
			&frame.Number,
			&frame.Path,
			&frame.Timestamp,
			&frame.Metadata,
		); err != nil {
			return nil, fmt.Errorf("failed to scan frame: %w", err)
		}
		frames = append(frames, frame)
	}

	return frames, nil
}

func (s *SingleStoreVectorStorage) BatchStore(ctx context.Context, vectors map[string][]float32) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, `
        INSERT INTO frame_vectors (frame_id, vector)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE vector = VALUES(vector)
    `)
	if err != nil {
		return fmt.Errorf("failed to prepare statement: %w", err)
	}
	defer stmt.Close()

	for id, vector := range vectors {
		if _, err := stmt.ExecContext(ctx, id, vector); err != nil {
			return fmt.Errorf("failed to store vector batch: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}
