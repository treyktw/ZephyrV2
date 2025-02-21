// internal/services/frame/extractor.go

package frame

import (
	"context"
	"fmt"
	"image"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"zephyrV2/internal/utils"
)

type ExtractorConfig struct {
	FrameRate     float64 // Frames per second to extract
	BatchSize     int     // Number of frames per batch
	MaxGoroutines int     // Concurrent extraction limit
	OutputQuality int     // JPEG quality (1-31, lower is better)
	TempDir       string  // Directory for temporary files
}

type Extractor struct {
	config    ExtractorConfig
	ffmpeg    *utils.FFmpeg
	errorChan chan error
}

type ExtractionResult struct {
	FramePath string
	FrameNum  int
	Timestamp float64
	Error     error
}

func NewExtractor(config ExtractorConfig) *Extractor {
	if config.OutputQuality < 1 || config.OutputQuality > 31 {
		config.OutputQuality = 2 // Default to high quality
	}
	if config.FrameRate <= 0 {
		config.FrameRate = 1.0 // Default to 1 fps
	}

	return &Extractor{
		config:    config,
		ffmpeg:    utils.NewFFmpeg(),
		errorChan: make(chan error, 100),
	}
}

// ExtractFrameRange extracts a specific range of frames from the video
func (e *Extractor) ExtractFrameRange(ctx context.Context, videoPath, outputDir string, startFrame, endFrame int) ([]ExtractionResult, error) {
	// Ensure output directory exists
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create output directory: %w", err)
	}

	// Calculate time range for extraction
	startTime := float64(startFrame) / e.config.FrameRate
	endTime := float64(endFrame) / e.config.FrameRate

	// Prepare FFmpeg command for frame range extraction
	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-ss", fmt.Sprintf("%.3f", startTime),
		"-t", fmt.Sprintf("%.3f", endTime-startTime),
		"-i", videoPath,
		"-vf", fmt.Sprintf("fps=%f", e.config.FrameRate),
		"-frame_pts", "1",
		"-q:v", fmt.Sprintf("%d", e.config.OutputQuality),
		"-start_number", fmt.Sprintf("%d", startFrame),
		filepath.Join(outputDir, "frame-%d.jpg"),
	)

	// Capture command output
	cmd.Stderr = os.Stderr

	// Execute frame extraction
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("frame extraction failed: %w", err)
	}

	// Collect and validate extracted frames
	return e.validateExtractedFrames(outputDir, startFrame, endFrame)
}

// ExtractKeyframes extracts important frames based on scene changes
func (e *Extractor) ExtractKeyframes(ctx context.Context, videoPath, outputDir string) ([]ExtractionResult, error) {
	// Create output directory
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create output directory: %w", err)
	}

	// First pass: detect scene changes
	sceneCmd := exec.CommandContext(ctx, "ffmpeg",
		"-i", videoPath,
		"-vf", "select=gt(scene\\,0.3)", // Adjust threshold as needed
		"-f", "null",
		"-",
	)

	sceneOutput, err := sceneCmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("scene detection failed: %w", err)
	}

	// Parse scene change timestamps
	// This is a simplified version - you'd need to parse the actual ffmpeg output
	sceneChanges := parseSceneChanges(string(sceneOutput))

	// Extract frames at scene changes
	var results []ExtractionResult
	for i, timestamp := range sceneChanges {
		outputPath := filepath.Join(outputDir, fmt.Sprintf("keyframe-%d.jpg", i))

		cmd := exec.CommandContext(ctx, "ffmpeg",
			"-ss", fmt.Sprintf("%.3f", timestamp),
			"-i", videoPath,
			"-vframes", "1",
			"-q:v", fmt.Sprintf("%d", e.config.OutputQuality),
			outputPath,
		)

		if err := cmd.Run(); err != nil {
			return results, fmt.Errorf("keyframe extraction failed at %f: %w", timestamp, err)
		}

		results = append(results, ExtractionResult{
			FramePath: outputPath,
			FrameNum:  i,
			Timestamp: timestamp,
		})
	}

	return results, nil
}

// ExtractFrameAt extracts a single frame at a specific timestamp
func (e *Extractor) ExtractFrameAt(ctx context.Context, videoPath string, timestamp float64, outputPath string) (*ExtractionResult, error) {
	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-ss", fmt.Sprintf("%.3f", timestamp),
		"-i", videoPath,
		"-vframes", "1",
		"-q:v", fmt.Sprintf("%d", e.config.OutputQuality),
		outputPath,
	)

	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("frame extraction failed at timestamp %.3f: %w", timestamp, err)
	}

	return &ExtractionResult{
		FramePath: outputPath,
		Timestamp: timestamp,
	}, nil
}

// Helper function to validate extracted frames
func (e *Extractor) validateExtractedFrames(outputDir string, startFrame, endFrame int) ([]ExtractionResult, error) {
	var results []ExtractionResult

	// Get all extracted frames
	frames, err := filepath.Glob(filepath.Join(outputDir, "frame-*.jpg"))
	if err != nil {
		return nil, fmt.Errorf("failed to list extracted frames: %w", err)
	}

	// Validate each frame
	for _, framePath := range frames {
		// Get frame number from filename
		var frameNum int
		_, err := fmt.Sscanf(filepath.Base(framePath), "frame-%d.jpg", &frameNum)
		if err != nil {
			continue
		}

		// Verify frame is within expected range
		if frameNum >= startFrame && frameNum <= endFrame {
			// Verify file is a valid image
			if err := e.verifyImage(framePath); err != nil {
				return results, fmt.Errorf("invalid frame %d: %w", frameNum, err)
			}

			results = append(results, ExtractionResult{
				FramePath: framePath,
				FrameNum:  frameNum,
				Timestamp: float64(frameNum) / e.config.FrameRate,
			})
		}
	}

	return results, nil
}

// Helper function to verify image file
func (e *Extractor) verifyImage(path string) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()

	// Try to decode the image header
	_, format, err := image.DecodeConfig(file)
	if err != nil {
		return fmt.Errorf("invalid image format: %w", err)
	}

	if format != "jpeg" {
		return fmt.Errorf("unexpected image format: %s", format)
	}

	return nil
}

func parseSceneChanges(output string) []float64 {
	var timestamps []float64

	// FFmpeg scene detection output looks like:
	// [detect_scenes @ 0x...] Scene cut at frame 123 (timestamp: 5.84)

	lines := strings.Split(output, "\n")
	sceneRegex := regexp.MustCompile(`Scene cut at frame \d+ \(timestamp: ([\d.]+)\)`)

	for _, line := range lines {
		matches := sceneRegex.FindStringSubmatch(line)
		if len(matches) > 1 {
			if timestamp, err := strconv.ParseFloat(matches[1], 64); err == nil {
				timestamps = append(timestamps, timestamp)
			}
		}
	}

	// Add additional scene detection using FFmpeg filters
	filterOutput := getSceneDetectionFromFilters(output)
	for _, timestamp := range filterOutput {
		if !contains(timestamps, timestamp) {
			timestamps = append(timestamps, timestamp)
		}
	}

	sort.Float64s(timestamps)
	return timestamps
}

func getSceneDetectionFromFilters(output string) []float64 {
	var timestamps []float64

	// Parse FFmpeg filter output format:
	// lavfi.scene_score=0.42
	scoreRegex := regexp.MustCompile(`lavfi\.scene_score=([\d.]+)`)
	timeRegex := regexp.MustCompile(`pts_time:([\d.]+)`)

	lines := strings.Split(output, "\n")
	var currentTime float64

	for _, line := range lines {
		if timeMatch := timeRegex.FindStringSubmatch(line); len(timeMatch) > 1 {
			currentTime, _ = strconv.ParseFloat(timeMatch[1], 64)
		}

		if scoreMatch := scoreRegex.FindStringSubmatch(line); len(scoreMatch) > 1 {
			score, _ := strconv.ParseFloat(scoreMatch[1], 64)
			if score > 0.3 { // Threshold for scene change
				timestamps = append(timestamps, currentTime)
			}
		}
	}

	return timestamps
}

func contains(slice []float64, val float64) bool {
	for _, item := range slice {
		if math.Abs(item-val) < 0.1 { // Consider timestamps within 0.1s the same
			return true
		}
	}
	return false
}
