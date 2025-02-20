package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"image"
	_ "image/jpeg" // for JPEG decoding
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"zephyrV2/internal/models"
)

type VideoService struct {
	uploadsDir string
	framesDir  string
	redis      *RedisClient
	frameRate  float64 // frames per second to extract
	quality    int     // JPEG quality (1-31, lower is better)
}

func NewVideoService(uploadsDir, framesDir string, redis *RedisClient, frameRate float64, quality int) *VideoService {

	if frameRate <= 0 {
		frameRate = 1.0 // Default to 1 frame per second
	}
	if quality < 1 || quality > 31 {
		quality = 2 // Default to high quality
	}

	return &VideoService{
		uploadsDir: uploadsDir,
		framesDir:  framesDir,
		redis:      redis,
		frameRate:  frameRate,
		quality:    quality,
	}
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
		if err := s.ProcessVideo(ctx, videoID); err != nil {
			log.Printf("Error processing video %s: %v", videoID, err)
			video.Status = models.VideoStatusError
			s.redis.UpdateVideo(ctx, video)
			continue
		}

		log.Printf("Completed processing video: %s", videoID)
	}

	return nil
}

func (s *VideoService) ProcessVideo(ctx context.Context, videoID string) error {
	// Construct paths
	videoDir := filepath.Join(s.uploadsDir, videoID)
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
	metadata, err := s.extractVideoMetadata(videoPath)
	if err != nil {
		return fmt.Errorf("failed to extract video metadata: %w", err)
	}

	// Update metadata.json with ffmpeg info
	if err := s.updateMetadataFile(videoDir, metadata); err != nil {
		log.Printf("Warning: Failed to update metadata file: %v", err)
	}

	// Calculate total frames for progress tracking
	duration, _ := strconv.ParseFloat(metadata.Duration, 64)
	totalFrames := int(duration * metadata.Fps)

	// Start frame extraction with progress tracking
	if err := s.extractFramesWithProgress(ctx, videoID, videoPath, framesDir, totalFrames); err != nil {
		return fmt.Errorf("frame extraction failed: %w", err)
	}

	return nil
}

func (s *VideoService) updateMetadataFile(videoDir string, metadata *models.VideoMetadata) error {
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

func (s *VideoService) extractVideoMetadata(videoPath string) (*models.VideoMetadata, error) {
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

func (s *VideoService) extractFramesWithProgress(ctx context.Context, videoID, videoPath, framesPath string, totalFrames int) error {
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
				s.updateProcessingStatus(ctx, videoID, models.ProcessingStatus{
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
	if err := s.generateFrameMetadata(ctx, videoID, framesPath, frames); err != nil {
		return fmt.Errorf("failed to generate frame metadata: %w", err)
	}

	return nil
}

func (s *VideoService) generateFrameMetadata(ctx context.Context, videoID, framesPath string, frames []os.DirEntry) error {
	frameMetadata := make([]models.FrameMetadata, 0, len(frames))

	for _, frame := range frames {
		if !frame.IsDir() {
			framePath := filepath.Join(framesPath, frame.Name())
			metadata, err := s.getFrameMetadata(framePath)
			if err != nil {
				log.Printf("Warning: Failed to get metadata for frame %s: %v", frame.Name(), err)
				continue
			}
			frameMetadata = append(frameMetadata, metadata)
		}
	}

	// Store frame metadata in Redis
	return s.saveFrameMetadata(ctx, videoID, frameMetadata)

}

func (s *VideoService) getFrameMetadata(framePath string) (models.FrameMetadata, error) {
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

func (s *VideoService) saveFrameMetadata(ctx context.Context, videoID string, metadata []models.FrameMetadata) error {
	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal frame metadata: %w", err)
	}

	key := fmt.Sprintf("video:%s:frames", videoID)
	if err := s.redis.client.Set(ctx, key, metadataJSON, 0).Err(); err != nil {
		return fmt.Errorf("failed to save frame metadata: %w", err)
	}

	return nil
}

func (s *VideoService) updateProcessingStatus(ctx context.Context, videoID string, status models.ProcessingStatus) error {
	statusJSON, err := json.Marshal(status)
	if err != nil {
		return fmt.Errorf("failed to marshal processing status: %w", err)
	}

	key := fmt.Sprintf("video:%s:processing", videoID)
	if err := s.redis.client.Set(ctx, key, statusJSON, 0).Err(); err != nil {
		return fmt.Errorf("failed to update processing status: %w", err)
	}

	return nil
}
