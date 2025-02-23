package video

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"zephyrV2/internal/config"
	"zephyrV2/internal/models"
	"zephyrV2/internal/services/frame"
	"zephyrV2/internal/services/storage"
)

type VideoService struct {
	uploadsDir     string
	framesDir      string
	redis          *storage.RedisClient
	frameRate      float64
	quality        int
	processor      *VideoProcessor
	frameProcessor *frame.Processor
	db             *sql.DB // Add this
}

func NewVideoService(
	uploadsDir string,
	framesDir string,
	redis *storage.RedisClient,
	frameRate float64,
	quality int,
	db *sql.DB,
	frameProcessor *frame.Processor,
) (*VideoService, error) {
	// Create processor config
	processorConfig := config.ProcessorConfigVideo{
		UploadsDir:  uploadsDir,
		FramesDir:   framesDir,
		RedisClient: redis,
		ExtractorConfig: frame.ExtractorConfig{
			FrameRate:     frameRate,
			OutputQuality: quality,
		},
	}

	// Initialize the processor
	processor := NewVideoProcessor(processorConfig, db)

	return &VideoService{
		uploadsDir:     uploadsDir,
		framesDir:      framesDir,
		redis:          redis,
		processor:      processor,
		frameRate:      frameRate,
		quality:        quality,
		frameProcessor: frameProcessor,
		db:             db,
	}, nil
}

func (s *VideoService) StartProcessing(ctx context.Context) error {
	log.Println("Starting video processing service...")

	// Create required directories
	for _, dir := range []string{s.uploadsDir, s.framesDir} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("failed to create directory %s: %w", dir, err)
		}
	}

	// Watch for new videos
	videoChan, err := s.redis.WatchNewVideos(ctx)
	if err != nil {
		return fmt.Errorf("failed to start watching videos: %w", err)
	}

	for videoID := range videoChan {
		log.Printf("Processing video: %s", videoID)

		// Update status to processing
		video, err := s.redis.GetVideo(ctx, videoID)
		if err != nil {
			log.Printf("Error getting video %s: %v", videoID, err)
			continue
		}

		video.Status = models.VideoStatusProcessing
		if err := s.redis.UpdateVideo(ctx, video); err != nil {
			log.Printf("Error updating video status: %v", err)
			continue
		}

		// Process the video
		if err := s.processor.ProcessVideo(ctx, videoID); err != nil {
			log.Printf("Error processing video %s: %v", videoID, err)
			video.Status = models.VideoStatusError
			s.redis.UpdateVideo(ctx, video)
			continue
		}

		log.Printf("Completed processing video: %s", videoID)
	}

	return nil
}
