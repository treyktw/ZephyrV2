// internal/services/storage/singlestore.go

package storage

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"time"
	"zephyrV2/internal/models"

	_ "github.com/go-sql-driver/mysql"
)

type SingleStoreConfig struct {
	Host         string
	Port         int
	User         string
	Password     string
	Database     string
	MaxOpenConns int
	MaxIdleConns int
}

type SingleStoreDB struct {
	db  *sql.DB
	cfg SingleStoreConfig
}

func NewSingleStoreDB(cfg SingleStoreConfig) (*SingleStoreDB, error) {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?parseTime=true",
		cfg.User,
		cfg.Password,
		cfg.Host,
		cfg.Port,
		cfg.Database,
	)

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to SingleStore: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(cfg.MaxOpenConns)
	db.SetMaxIdleConns(cfg.MaxIdleConns)
	db.SetConnMaxLifetime(time.Hour)

	// Test connection
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping SingleStore: %w", err)
	}

	return &SingleStoreDB{
		db:  db,
		cfg: cfg,
	}, nil
}

func (s *SingleStoreDB) BeginTx(ctx context.Context, opts *sql.TxOptions) (*sql.Tx, error) {
	return s.db.BeginTx(ctx, opts)
}

// InitSchema creates necessary tables and indices
func (s *SingleStoreDB) InitSchema(ctx context.Context) error {
	queries := []string{
		// Videos table
		`CREATE TABLE IF NOT EXISTS videos (
            id VARCHAR(36) NOT NULL,
            filename VARCHAR(255) NOT NULL,
            status VARCHAR(20) NOT NULL,
            metadata JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        )`,

		// Frames table
		`CREATE TABLE IF NOT EXISTS frames (
            id VARCHAR(36) NOT NULL,
            video_id VARCHAR(36) NOT NULL,
            frame_number INT NOT NULL,
            timestamp DECIMAL(10,3) NOT NULL,
            path VARCHAR(255) NOT NULL,
            metadata JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_video_id (video_id),
            INDEX idx_timestamp (timestamp)
        )`,

		// Frame vectors table with vector support
		`CREATE TABLE IF NOT EXISTS frame_vectors (
            frame_id VARCHAR(36) NOT NULL,
            vector VARBINARY(1536), -- Adjust size based on your vector dimension
            metadata JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (frame_id),
            INDEX idx_creation (created_at)
        )`,
	}

	for _, query := range queries {
		if _, err := s.db.ExecContext(ctx, query); err != nil {
			return fmt.Errorf("failed to create schema: %w", err)
		}
	}

	return nil
}

// Video operations
func (s *SingleStoreDB) SaveVideo(ctx context.Context, video *models.Video) error {
	metadata, err := json.Marshal(video.Metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	query := `
        INSERT INTO videos (id, filename, status, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            status = VALUES(status),
            metadata = VALUES(metadata),
            updated_at = VALUES(updated_at)
    `

	_, err = s.db.ExecContext(ctx, query,
		video.ID,
		video.Filename,
		video.Status,
		metadata,
		video.CreatedAt,
		video.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to save video: %w", err)
	}

	return nil
}

func (s *SingleStoreDB) GetVideo(ctx context.Context, id string) (*models.Video, error) {
	query := `
        SELECT id, filename, status, metadata, created_at, updated_at
        FROM videos
        WHERE id = ?
    `

	var video models.Video
	var metadataBytes []byte

	err := s.db.QueryRowContext(ctx, query, id).Scan(
		&video.ID,
		&video.Filename,
		&video.Status,
		&metadataBytes,
		&video.CreatedAt,
		&video.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get video: %w", err)
	}

	if err := json.Unmarshal(metadataBytes, &video.Metadata); err != nil {
		return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
	}

	return &video, nil
}

// Frame operations
func (s *SingleStoreDB) SaveFrame(ctx context.Context, frame *models.Frame) error {
	metadata, err := json.Marshal(frame.Metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	query := `
        INSERT INTO frames (id, video_id, frame_number, timestamp, path, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            metadata = VALUES(metadata)
    `

	_, err = s.db.ExecContext(ctx, query,
		frame.ID,
		frame.VideoID,
		frame.Number,
		frame.Timestamp,
		frame.Path,
		metadata,
	)

	if err != nil {
		return fmt.Errorf("failed to save frame: %w", err)
	}

	// Save vector if present
	if frame.Vector != nil {
		if err := s.SaveFrameVector(ctx, frame.ID, frame.Vector); err != nil {
			return fmt.Errorf("failed to save frame vector: %w", err)
		}
	}

	return nil
}

func (s *SingleStoreDB) GetFramesByVideo(ctx context.Context, videoID string) ([]models.Frame, error) {
	query := `
        SELECT f.id, f.video_id, f.frame_number, f.timestamp, f.path, f.metadata,
               fv.vector
        FROM frames f
        LEFT JOIN frame_vectors fv ON f.id = fv.frame_id
        WHERE f.video_id = ?
        ORDER BY f.frame_number
    `

	rows, err := s.db.QueryContext(ctx, query, videoID)
	if err != nil {
		return nil, fmt.Errorf("failed to get frames: %w", err)
	}
	defer rows.Close()

	var frames []models.Frame
	for rows.Next() {
		var frame models.Frame
		var metadataBytes []byte
		var vectorBytes []byte

		err := rows.Scan(
			&frame.ID,
			&frame.VideoID,
			&frame.Number,
			&frame.Timestamp,
			&frame.Path,
			&metadataBytes,
			&vectorBytes,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan frame: %w", err)
		}

		if err := json.Unmarshal(metadataBytes, &frame.Metadata); err != nil {
			return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
		}

		if len(vectorBytes) > 0 {
			// Convert vector bytes to []float32
			frame.Vector = bytesToVector(vectorBytes)
		}

		frames = append(frames, frame)
	}

	return frames, nil
}

// Vector operations
func (s *SingleStoreDB) SaveFrameVector(ctx context.Context, frameID string, vector []float32) error {
	vectorBytes := vectorToBytes(vector)

	query := `
        INSERT INTO frame_vectors (frame_id, vector)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE
            vector = VALUES(vector)
    `

	_, err := s.db.ExecContext(ctx, query, frameID, vectorBytes)
	if err != nil {
		return fmt.Errorf("failed to save frame vector: %w", err)
	}

	return nil
}

func (s *SingleStoreDB) FindSimilarFrames(ctx context.Context, vector []float32, limit int) ([]models.Frame, error) {
	query := `
        SELECT f.id, f.video_id, f.frame_number, f.timestamp, f.path, f.metadata,
               fv.vector, DOT_PRODUCT(fv.vector, ?) as similarity
        FROM frames f
        JOIN frame_vectors fv ON f.id = fv.frame_id
        ORDER BY similarity DESC
        LIMIT ?
    `

	vectorBytes := vectorToBytes(vector)
	rows, err := s.db.QueryContext(ctx, query, vectorBytes, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to find similar frames: %w", err)
	}
	defer rows.Close()

	var frames []models.Frame
	for rows.Next() {
		var frame models.Frame
		var metadataBytes []byte
		var vectorBytes []byte
		var similarity float64

		err := rows.Scan(
			&frame.ID,
			&frame.VideoID,
			&frame.Number,
			&frame.Timestamp,
			&frame.Path,
			&metadataBytes,
			&vectorBytes,
			&similarity,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan frame: %w", err)
		}

		if err := json.Unmarshal(metadataBytes, &frame.Metadata); err != nil {
			return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
		}

		if len(vectorBytes) > 0 {
			frame.Vector = bytesToVector(vectorBytes)
		}

		// Add similarity score to metadata
		if frame.Metadata == nil {
			frame.Metadata = make(map[string]interface{})
		}
		metadata := frame.Metadata
		metadata["similarity_score"] = similarity
		frame.Metadata = metadata

		frames = append(frames, frame)
	}

	return frames, nil
}

func vectorToBytes(vector []float32) []byte {
	buf := new(bytes.Buffer)

	// Write vector length
	binary.Write(buf, binary.LittleEndian, int32(len(vector)))

	// Write vector data
	for _, v := range vector {
		err := binary.Write(buf, binary.LittleEndian, v)
		if err != nil {
			// In production, you might want to handle this error differently
			return nil
		}
	}

	return buf.Bytes()
}

func bytesToVector(data []byte) []float32 {
	if len(data) < 4 {
		return nil
	}

	buf := bytes.NewReader(data)

	// Read vector length
	var length int32
	if err := binary.Read(buf, binary.LittleEndian, &length); err != nil {
		return nil
	}

	// Read vector data
	vector := make([]float32, length)
	for i := range vector {
		if err := binary.Read(buf, binary.LittleEndian, &vector[i]); err != nil {
			return nil
		}
	}

	return vector
}

// Close closes the database connection
func (s *SingleStoreDB) Close() error {
	return s.db.Close()
}

// internal/services/storage/singlestore.go

func (s *SingleStoreDB) FindSimilarVectors(ctx context.Context, vector []float32, limit int) ([]string, error) {
	query := `
        SELECT frame_id, DOT_PRODUCT(vector, ?) as similarity
        FROM frame_vectors
        WHERE vector IS NOT NULL
        ORDER BY similarity DESC
        LIMIT ?
    `

	vectorBytes := vectorToBytes(vector)
	rows, err := s.db.QueryContext(ctx, query, vectorBytes, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to find similar vectors: %w", err)
	}
	defer rows.Close()

	var frameIDs []string
	for rows.Next() {
		var id string
		var similarity float64
		if err := rows.Scan(&id, &similarity); err != nil {
			return nil, err
		}
		frameIDs = append(frameIDs, id)
	}

	return frameIDs, nil
}

func (s *SingleStoreDB) UpdateFrameRelationships(ctx context.Context, frameID string, relationships struct {
	Similar    []string `json:"similar,omitempty"`
	Sequential []string `json:"sequential,omitempty"`
	Scene      []string `json:"scene,omitempty"`
}) error {
	relationshipsMap := map[string]interface{}{
		"relationships": relationships,
	}

	// Convert to JSON
	relationshipsJSON, err := json.Marshal(relationshipsMap)
	if err != nil {
		return fmt.Errorf("failed to marshal relationships: %w", err)
	}

	query := `
        UPDATE frames
        SET metadata = JSON_MERGE_PATCH(
            COALESCE(metadata, '{}'),
            ?
        )
        WHERE id = ?
    `

	_, err = s.db.ExecContext(ctx, query, string(relationshipsJSON), frameID)
	if err != nil {
		return fmt.Errorf("failed to update frame relationships: %w", err)
	}

	return nil
}

func (s *SingleStoreDB) QueryContext(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) {
	return s.db.QueryContext(ctx, query, args...)
}
