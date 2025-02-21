package video

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
	"zephyrV2/internal/models"
	"zephyrV2/internal/services/storage"
)

type VideoMetadataHandler struct {
	redis *storage.RedisClient
}

func NewVideoMetadataHandler(redis *storage.RedisClient) *VideoMetadataHandler {
	return &VideoMetadataHandler{
		redis: redis,
	}
}

func (h *VideoMetadataHandler) ExtractVideoMetadata(videoPath string) (*models.VideoMetadata, error) {
	cmd := exec.Command(
		"ffprobe",
		"-v", "quiet",
		"-print_format", "json",
		"-show_format",
		"-show_streams",
		videoPath,
	)

	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("ffprobe failed: %w", err)
	}

	var probeData struct {
		Streams []struct {
			Width    int     `json:"width"`
			Height   int     `json:"height"`
			Duration float64 `json:"duration,string"`
			FPS      string  `json:"r_frame_rate"`
		} `json:"streams"`
		Format struct {
			Size     string `json:"size"`
			Format   string `json:"format_name"`
			Duration string `json:"duration"`
		} `json:"format"`
	}

	if err := json.Unmarshal(output, &probeData); err != nil {
		return nil, fmt.Errorf("failed to parse probe data: %w", err)
	}

	// Get video stream info (usually first stream)
	if len(probeData.Streams) == 0 {
		return nil, fmt.Errorf("no video streams found")
	}

	videoStream := probeData.Streams[0]
	fileSize, _ := strconv.ParseInt(probeData.Format.Size, 10, 64)
	fpsNums := strings.Split(videoStream.FPS, "/")
	num, _ := strconv.ParseFloat(fpsNums[0], 64)
	den, _ := strconv.ParseFloat(fpsNums[1], 64)
	fps := num / den

	return &models.VideoMetadata{
		Duration: strconv.FormatFloat(videoStream.Duration, 'f', 2, 64),
		Size:     fileSize,
		Format:   probeData.Format.Format,
		Width:    videoStream.Width,
		Height:   videoStream.Height,
		Fps:      fps,
	}, nil
}

func (h *VideoMetadataHandler) updateMetadataFile(videoDir string, metadata *models.VideoMetadata) error {
	metadataPath := filepath.Join(videoDir, "metadata.json")

	// Read existing metadata
	data, err := os.ReadFile(metadataPath)
	if err != nil {
		return err
	}

	var existingMetadata map[string]interface{}
	if err := json.Unmarshal(data, &existingMetadata); err != nil {
		return err
	}

	// Update with new metadata
	existingMetadata["video_info"] = metadata
	existingMetadata["updated_at"] = time.Now().Unix()

	// Write back
	updatedData, err := json.MarshalIndent(existingMetadata, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(metadataPath, updatedData, 0644)
}

func (h *VideoMetadataHandler) saveFrameMetadata(ctx context.Context, videoID string, metadata []models.FrameMetadata) error {
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
