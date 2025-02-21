package frame

import (
	"context"
	"encoding/json"
	"fmt"
	"image"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"zephyrV2/internal/models"
	"zephyrV2/internal/services/storage"
)

type EnhancedMetadata struct {
	Basic struct {
		Resolution string
		Format     string
		Size       int64
		Duration   float64
	}
	Analysis struct {
		Objects []models.DetectedObject
		Scenes  []models.SceneInfo
		Text    *models.OCRInfo
		Faces   []models.FaceInfo
	}
	Vectors struct {
		Image    []float32 // Image embedding
		Text     []float32 // Text embedding
		Combined []float32 // Combined embedding
	}
	Relationships struct {
		Similar     []string // IDs of similar frames
		Sequential  []string // IDs of frames before/after
		Scene       []string // IDs of frames in same scene
		ObjectBased []string // IDs of frames with similar objects
	}
	Metrics struct {
		Quality   float64
		Relevance float64
		Novelty   float64
	}
}

type RelationshipType string

const (
	RelVisual    RelationshipType = "visual"
	RelTemporal  RelationshipType = "temporal"
	RelSemantic  RelationshipType = "semantic"
	RelNarrative RelationshipType = "narrative"
)

type MetadataHandler struct {
	redis *storage.RedisClient
}

func NewMetadataHandler(redis *storage.RedisClient) *MetadataHandler {
	return &MetadataHandler{
		redis: redis,
	}
}

func (h *MetadataHandler) GetFrameMetadata(framePath string) (models.FrameMetadata, error) {
	fileInfo, err := os.Stat(framePath)
	if err != nil {
		return models.FrameMetadata{}, fmt.Errorf("failed to get frame info: %w", err)
	}

	// Extract frame number from filename (assuming format frame-X.jpg)
	frameNum, err := strconv.Atoi(strings.TrimPrefix(
		strings.TrimSuffix(filepath.Base(framePath), ".jpg"),
		"frame-",
	))
	if err != nil {
		return models.FrameMetadata{}, fmt.Errorf("failed to parse frame number: %w", err)
	}

	// Get image dimensions
	file, err := os.Open(framePath)
	if err != nil {
		return models.FrameMetadata{}, fmt.Errorf("failed to open frame: %w", err)
	}
	defer file.Close()

	img, _, err := image.DecodeConfig(file)
	if err != nil {
		return models.FrameMetadata{}, fmt.Errorf("failed to decode frame: %w", err)
	}

	return models.FrameMetadata{
		FrameNumber: frameNum,
		Timestamp:   fmt.Sprintf("%d:00", frameNum), // Simple timestamp for now
		Path:        framePath,
		Size:        fileInfo.Size(),
		Resolution:  fmt.Sprintf("%dx%d", img.Width, img.Height),
	}, nil
}

func (h *MetadataHandler) GenerateFrameMetadata(ctx context.Context, videoID, framesPath string, frames []os.DirEntry) error {
	frameMetadata := make([]models.FrameMetadata, 0, len(frames))

	for _, frame := range frames {
		if !frame.IsDir() {
			framePath := filepath.Join(framesPath, frame.Name())
			metadata, err := h.GetFrameMetadata(framePath)
			if err != nil {
				log.Printf("Warning: Failed to get metadata for frame %s: %v", frame.Name(), err)
				continue
			}
			frameMetadata = append(frameMetadata, metadata)
		}
	}

	// Store frame metadata in Redis
	return h.saveFrameMetadata(ctx, videoID, frameMetadata)

}

func (h *MetadataHandler) saveFrameMetadata(ctx context.Context, videoID string, metadata []models.FrameMetadata) error {
	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal frame metadata: %w", err)
	}

	key := fmt.Sprintf("video:%s:frames", videoID)
	if err := h.redis.Client.Set(ctx, key, metadataJSON, 0).Err(); err != nil {
		return fmt.Errorf("failed to save frame metadata: %w", err)
	}

	return nil
}

func (rt *RelationshipTracker) TrackRelationships(ctx context.Context, frame *models.Frame) error {
	// Convert generic metadata to enhanced
	enhanced := models.MetadataToEnhanced(frame.Metadata)

	// Initialize relationships if needed
	if enhanced.Relationships.Similar == nil {
		enhanced.Relationships.Similar = make([]string, 0)
	}

	// Track visual similarity
	similar, err := rt.findSimilarFrames(ctx, frame.Vector)
	if err != nil {
		return err
	}
	enhanced.Relationships.Similar = similar

	// Track temporal relationships
	sequential, err := rt.getSequentialFrames(ctx, frame)
	if err != nil {
		return err
	}
	enhanced.Relationships.Sequential = sequential

	// Track scene relationships
	scene, err := rt.getSceneFrames(ctx, frame)
	if err != nil {
		return err
	}
	enhanced.Relationships.Scene = scene

	// Convert back and update the frame's metadata
	relationshipData := models.EnhancedToMetadata(enhanced)

	// Update only the relationships in the original metadata
	if frame.Metadata == nil {
		frame.Metadata = make(map[string]interface{})
	}
	frame.Metadata["relationships"] = relationshipData["relationships"]

	relationships := struct {
		Similar    []string `json:"similar,omitempty"`
		Sequential []string `json:"sequential,omitempty"`
		Scene      []string `json:"scene,omitempty"`
	}{
		Similar:    enhanced.Relationships.Similar,
		Sequential: enhanced.Relationships.Sequential,
		Scene:      enhanced.Relationships.Scene,
	}
	return rt.store.UpdateFrameRelationships(ctx, frame.ID, relationships)
}

func (rt *RelationshipTracker) findSimilarFrames(ctx context.Context, vector []float32) ([]string, error) {
	return rt.store.FindSimilarVectors(ctx, vector, 5)
}
