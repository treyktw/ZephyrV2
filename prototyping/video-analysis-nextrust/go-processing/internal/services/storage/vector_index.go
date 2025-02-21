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
