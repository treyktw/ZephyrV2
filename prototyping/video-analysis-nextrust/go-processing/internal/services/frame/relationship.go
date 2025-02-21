// internal/services/frame/relationship.go
package frame

import (
	"context"
	"fmt"
	"sync"
	"zephyrV2/internal/models"
	"zephyrV2/internal/services/storage"
)

type RelationshipTracker struct {
	store  *storage.SingleStoreDB
	cache  *sync.Map
	config models.RelationshipConfig
}

func NewRelationshipTracker(store *storage.SingleStoreDB, config models.RelationshipConfig) *RelationshipTracker {
	return &RelationshipTracker{
		store:  store,
		cache:  &sync.Map{},
		config: config,
	}
}

func (rt *RelationshipTracker) getSequentialFrames(ctx context.Context, frame *models.Frame) ([]string, error) {
	// Get frames before and after the current frame
	query := `
        SELECT id FROM frames
        WHERE video_id = ?
        AND frame_number BETWEEN ? AND ?
        AND id != ?
        ORDER BY frame_number
    `

	window := rt.config.TemporalWindow
	startFrame := frame.Number - window
	endFrame := frame.Number + window

	var frameIDs []string
	rows, err := rt.store.QueryContext(ctx, query, frame.VideoID, startFrame, endFrame, frame.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get sequential frames: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		frameIDs = append(frameIDs, id)
	}

	return frameIDs, nil
}

func (rt *RelationshipTracker) getSceneFrames(ctx context.Context, frame *models.Frame) ([]string, error) {
	// Get frames that belong to the same scene
	query := `
        SELECT f.id
        FROM frames f
        JOIN frame_scenes fs ON f.id = fs.frame_id
        WHERE fs.scene_id = (
            SELECT scene_id
            FROM frame_scenes
            WHERE frame_id = ?
        )
        AND f.id != ?
    `

	var frameIDs []string
	rows, err := rt.store.QueryContext(ctx, query, frame.ID, frame.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get scene frames: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		frameIDs = append(frameIDs, id)
	}

	return frameIDs, nil
}
