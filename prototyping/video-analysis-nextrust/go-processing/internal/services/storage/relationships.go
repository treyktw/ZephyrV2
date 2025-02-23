// internal/services/storage/relationships.go
package storage

import (
	"context"
	"database/sql"
	"encoding/json"
)

type FrameRelationship struct {
	FrameID      string
	RelationType string
	RelatedFrame string
	Strength     float64
	Metadata     json.RawMessage
	db           *sql.DB
}

func NewFrameRelationship(db *sql.DB) *FrameRelationship {
	return &FrameRelationship{
		db: db,
	}
}

func (s *SingleStoreDB) StoreFrameRelationship(ctx context.Context, rel FrameRelationship) error {
	query := `
        INSERT INTO frame_relationships
        (frame_id, relation_type, related_frame, strength, metadata)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            strength = VALUES(strength),
            metadata = VALUES(metadata)
    `

	_, err := s.db.ExecContext(ctx, query,
		rel.FrameID,
		rel.RelationType,
		rel.RelatedFrame,
		rel.Strength,
		rel.Metadata,
	)

	return err
}

func (s *SingleStoreDB) FindRelatedFrames(ctx context.Context, frameID string, relationType string) ([]FrameRelationship, error) {
	query := `
        SELECT frame_id, relation_type, related_frame, strength, metadata
        FROM frame_relationships
        WHERE frame_id = ? AND relation_type = ?
        ORDER BY strength DESC
    `

	rows, err := s.db.QueryContext(ctx, query, frameID, relationType)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var relationships []FrameRelationship
	for rows.Next() {
		var rel FrameRelationship
		if err := rows.Scan(
			&rel.FrameID,
			&rel.RelationType,
			&rel.RelatedFrame,
			&rel.Strength,
			&rel.Metadata,
		); err != nil {
			return nil, err
		}
		relationships = append(relationships, rel)
	}

	return relationships, nil
}
