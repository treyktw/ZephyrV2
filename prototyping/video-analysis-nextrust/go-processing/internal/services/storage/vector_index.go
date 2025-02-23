// internal/services/storage/vector_index.go
package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"
)

type VectorIndex struct {
	db           *SingleStoreDB
	batchSize    int
	flushTimeout time.Duration
	buffer       []*VectorEntry
	mutex        sync.Mutex
	flushChan    chan struct{}
}

type VectorEntry struct {
	ID        string
	Vector    []float32
	Metadata  map[string]interface{}
	Timestamp time.Time
}

func NewVectorIndex(db *SingleStoreDB, batchSize int, flushTimeout time.Duration) *VectorIndex {
	vi := &VectorIndex{
		db:           db,
		batchSize:    batchSize,
		flushTimeout: flushTimeout,
		buffer:       make([]*VectorEntry, 0, batchSize),
		flushChan:    make(chan struct{}, 1),
	}

	go vi.backgroundFlush()
	return vi
}

func (vi *VectorIndex) Insert(ctx context.Context, entry *VectorEntry) error {
	vi.mutex.Lock()
	vi.buffer = append(vi.buffer, entry)
	shouldFlush := len(vi.buffer) >= vi.batchSize
	vi.mutex.Unlock()

	if shouldFlush {
		return vi.Flush(ctx)
	}

	// Signal background flush
	select {
	case vi.flushChan <- struct{}{}:
	default:
	}

	return nil
}

func (vi *VectorIndex) Flush(ctx context.Context) error {
	vi.mutex.Lock()
	if len(vi.buffer) == 0 {
		vi.mutex.Unlock()
		return nil
	}

	batch := vi.buffer
	vi.buffer = make([]*VectorEntry, 0, vi.batchSize)
	vi.mutex.Unlock()

	// Use BeginTx with context
	tx, err := vi.db.BeginTx(ctx, &sql.TxOptions{
		Isolation: sql.LevelDefault,
		ReadOnly:  false,
	})
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback() // Rollback if we don't commit

	// Prepare batch insert
	stmt, err := tx.PrepareContext(ctx, `
        INSERT INTO frame_vectors (id, vector, metadata, created_at)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            vector = VALUES(vector),
            metadata = VALUES(metadata)
    `)
	if err != nil {
		return fmt.Errorf("failed to prepare statement: %w", err)
	}
	defer stmt.Close()

	for _, entry := range batch {
		vectorBytes := vectorToBytes(entry.Vector)
		metadataJSON, err := json.Marshal(entry.Metadata)
		if err != nil {
			return fmt.Errorf("failed to marshal metadata: %w", err)
		}

		_, err = stmt.ExecContext(ctx,
			entry.ID,
			vectorBytes,
			metadataJSON,
			entry.Timestamp,
		)
		if err != nil {
			return fmt.Errorf("failed to insert vector: %w", err)
		}
	}

	// Commit the transaction
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

func (vi *VectorIndex) backgroundFlush() {
	ticker := time.NewTicker(vi.flushTimeout)
	defer ticker.Stop()

	for {
		select {
		case <-vi.flushChan:
			if err := vi.Flush(context.Background()); err != nil {
				log.Printf("Background flush error: %v", err)
			}
		case <-ticker.C:
			if err := vi.Flush(context.Background()); err != nil {
				log.Printf("Background flush error: %v", err)
			}
		}
	}
}

func (v *VectorIndex) GetVector(ctx context.Context, id string) ([]float32, error) {
	query := `
        SELECT vector
        FROM frame_vectors
        WHERE frame_id = ?
    `

	var vectorBytes []byte
	err := v.db.db.QueryRowContext(ctx, query, id).Scan(&vectorBytes)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("vector not found for id: %s", id)
		}
		return nil, fmt.Errorf("failed to get vector: %w", err)
	}

	// Convert bytes back to vector
	vector := bytesToVector(vectorBytes)

	return vector, nil
}

func (v *VectorIndex) StoreVector(context.Context, string, []float32) error {
	// Implementation here
	return nil
}

func (v *VectorIndex) BatchStore(ctx context.Context, vectors map[string][]float32) error {
	// Implementation here
	return nil
}

// Add the missing FindSimilar method
func (v *VectorIndex) FindSimilar(ctx context.Context, vector []float32, limit int) ([]string, error) {
	query := `
        SELECT frame_id, DOT_PRODUCT(vector, ?) as similarity
        FROM frame_vectors
        ORDER BY similarity DESC
        LIMIT ?
    `

	// Convert vector to bytes for storage
	vectorBytes := vectorToBytes(vector)

	rows, err := v.db.db.QueryContext(ctx, query, vectorBytes, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []string
	for rows.Next() {
		var id string
		var similarity float64
		if err := rows.Scan(&id, &similarity); err != nil {
			return nil, err
		}
		results = append(results, id)
	}

	return results, nil
}
