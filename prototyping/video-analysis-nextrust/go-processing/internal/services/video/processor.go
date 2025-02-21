package video

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"time"
	"zephyrV2/internal/config"
	"zephyrV2/internal/models"
	"zephyrV2/internal/services/frame"
	"zephyrV2/internal/services/storage"
)

type VideoProcessor struct {
	uploadsDir      string
	framesDir       string
	frameExtractor  *frame.Extractor
	frameMetadata   *frame.MetadataHandler
	metadataHandler *VideoMetadataHandler
	redis           *storage.RedisClient
}

func NewVideoProcessor(config config.ProcessorConfigVideo) *VideoProcessor {
	metadataHandler := NewVideoMetadataHandler(config.RedisClient)
	frameMetadata := frame.NewMetadataHandler(config.RedisClient)

	return &VideoProcessor{
		uploadsDir:      config.UploadsDir,
		framesDir:       config.FramesDir,
		frameExtractor:  frame.NewExtractor(config.ExtractorConfig),
		frameMetadata:   frameMetadata,
		metadataHandler: metadataHandler,
		redis:           config.RedisClient,
	}
}

func (p *VideoProcessor) ProcessVideo(ctx context.Context, videoID string) error {
	// Construct paths
	videoDir := filepath.Join(p.uploadsDir, videoID)
	videoPath := filepath.Join(videoDir, "original.mp4")
	framesDir := filepath.Join(videoDir, "frames")

	// Initial video validation
	if _, err := os.Stat(videoPath); os.IsNotExist(err) {
		return fmt.Errorf("video file not found: %w", err)
	}

	// Create frames directory
	if err := os.MkdirAll(framesDir, 0755); err != nil {
		return fmt.Errorf("failed to create frames directory: %w", err)
	}

	// Extract video metadata first
	metadata, err := p.metadataHandler.ExtractVideoMetadata(videoPath)
	if err != nil {
		return fmt.Errorf("failed to extract video metadata: %w", err)
	}

	// Update metadata.json with ffmpeg info
	if err := p.metadataHandler.updateMetadataFile(videoDir, metadata); err != nil {
		log.Printf("Warning: Failed to update metadata file: %v", err)
	}

	// Calculate total frames for progress tracking
	duration, _ := strconv.ParseFloat(metadata.Duration, 64)
	totalFrames := int(duration * metadata.Fps)

	// Start frame extraction with progress tracking
	if err := p.extractFramesWithProgress(ctx, videoID, videoPath, framesDir, totalFrames); err != nil {
		return fmt.Errorf("frame extraction failed: %w", err)
	}

	return nil
}

func (p *VideoProcessor) extractFramesWithProgress(ctx context.Context, videoID, videoPath, framesPath string, totalFrames int) error {
	// Create ffmpeg command with frame naming and timestamp overlay
	cmd := exec.Command("ffmpeg",
		"-i", videoPath,
		"-vf", "fps=1,drawtext=text='%{pts\\:hms}':x=10:y=10:fontsize=24:fontcolor=white",
		"-frame_pts", "1",
		"-q:v", "2", // High quality JPEG
		filepath.Join(framesPath, "frame-%d.jpg"),
	)

	stderr := &bytes.Buffer{}
	cmd.Stderr = stderr

	// Start the command
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start ffmpeg: %w", err)
	}

	// Monitor progress
	go func() {
		processed := 0
		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				cmd.Process.Kill()
				return
			case <-ticker.C:
				frames, _ := os.ReadDir(framesPath)
				processed = len(frames)
				progress := float64(processed) / float64(totalFrames) * 100

				// Update processing status in Redis
				p.updateProcessingStatus(ctx, videoID, models.ProcessingStatus{
					Status:          "processing",
					Progress:        int(progress),
					FramesProcessed: processed,
					LastUpdate:      time.Now().Unix(),
				})
			}
		}
	}()

	// Wait for completion
	if err := cmd.Wait(); err != nil {
		return fmt.Errorf("ffmpeg failed: %s\n%s", err, stderr.String())
	}

	// Verify frame extraction
	frames, err := os.ReadDir(framesPath)
	if err != nil {
		return fmt.Errorf("failed to read frames directory: %w", err)
	}

	if len(frames) == 0 {
		return fmt.Errorf("no frames were extracted")
	}

	// Generate frame metadata
	if err := p.frameMetadata.GenerateFrameMetadata(ctx, videoID, framesPath, frames); err != nil {
		return fmt.Errorf("failed to generate frame metadata: %w", err)
	}

	return nil
}

func (p *VideoProcessor) updateProcessingStatus(ctx context.Context, videoID string, status models.ProcessingStatus) error {
	statusJSON, err := json.Marshal(status)
	if err != nil {
		return fmt.Errorf("failed to marshal processing status: %w", err)
	}

	key := fmt.Sprintf("video:%s:processing", videoID)
	if err := p.metadataHandler.redis.Client.Set(ctx, key, statusJSON, 0).Err(); err != nil {
		return fmt.Errorf("failed to update processing status: %w", err)
	}

	return nil
}
