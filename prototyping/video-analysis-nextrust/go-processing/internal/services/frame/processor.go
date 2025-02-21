// internal/services/frame/processor.go

package frame

import (
	"context"
	"fmt"
	"image"
	"math"
	"os"
	"path/filepath"
	"sync"
	"time"
	"zephyrV2/internal/models"
	"zephyrV2/internal/services/ml"
	"zephyrV2/internal/services/storage"
	"zephyrV2/internal/services/vector"
	"zephyrV2/internal/utils"
)

type ProcessorConfig struct {
	BatchSize        int
	MaxGoroutines    int
	QualityThreshold float64
	FrameRate        float64
}

type Processor struct {
	config        ProcessorConfig
	extractor     *Extractor
	quality       *QualityAnalyzer
	metadata      *MetadataHandler
	vector        *vector.Generator
	mutex         sync.Mutex
	previousFrame image.Image
	motionMutex   sync.Mutex
	mlManager     *ml.ModelManager     // Add this
	vectorIndex   *storage.VectorIndex // Add this
}

type ProcessResult struct {
	Frame    models.Frame
	Error    error
	Metadata map[string]interface{}
	Vector   []float32
}

func NewProcessor(config ProcessorConfig, vectorGen *vector.Generator, mlManager *ml.ModelManager, vectorIndex *storage.VectorIndex) *Processor {
	return &Processor{
		config: config,
		extractor: NewExtractor(ExtractorConfig{
			FrameRate:     config.FrameRate,
			BatchSize:     config.BatchSize,
			MaxGoroutines: config.MaxGoroutines,
		}),
		quality:     NewQualityAnalyzer(),
		metadata:    NewMetadataHandler(&storage.RedisClient{}),
		vector:      vectorGen,
		mlManager:   mlManager,
		vectorIndex: vectorIndex,
	}
}

// ProcessFrame handles the complete processing of a single frame
func (p *Processor) ProcessFrame(ctx context.Context, framePath string, videoID string, frameNum int) (*ProcessResult, error) {
	result := &ProcessResult{}

	// Create frame model
	frame := models.Frame{
		ID:      utils.GenerateUUID(), // Implement this helper function
		VideoID: videoID,
		Number:  frameNum,
		Path:    framePath,
	}

	// Run frame analysis in parallel
	var wg sync.WaitGroup
	var errChan = make(chan error, 3)

	// Quality Analysis
	wg.Add(1)
	go func() {
		defer wg.Done()
		quality, err := p.quality.AnalyzeFrame(framePath)
		if err != nil {
			errChan <- fmt.Errorf("quality analysis failed: %w", err)
			return
		}
		p.mutex.Lock()
		frame.Quality = quality
		p.mutex.Unlock()
	}()

	// Vector Generation
	wg.Add(1)
	go func() {
		defer wg.Done()
		vector, err := p.vector.GenerateVector(ctx, framePath)
		if err != nil {
			errChan <- fmt.Errorf("vector generation failed: %w", err)
			return
		}
		p.mutex.Lock()
		frame.Vector = vector
		p.mutex.Unlock()
	}()

	// Content Analysis
	wg.Add(1)
	go func() {
		defer wg.Done()
		metadata, err := p.AnalyzeFrameContent(framePath)
		if err != nil {
			errChan <- fmt.Errorf("content analysis failed: %w", err)
			return
		}
		p.mutex.Lock()
		frame.Metadata = metadata
		p.mutex.Unlock()
	}()

	// Wait for all processing to complete
	wg.Wait()
	close(errChan)

	// Check for errors
	if len(errChan) > 0 {
		var errStr string
		for err := range errChan {
			errStr += err.Error() + "; "
		}
		return nil, fmt.Errorf("frame processing errors: %s", errStr)
	}

	img, err := utils.LoadImage(framePath)
	if err != nil {
		return nil, fmt.Errorf("failed to load image: %w", err)
	}

	mlResults, err := p.mlManager.AnalyzeFrame(ctx, img)
	if err != nil {
		return nil, fmt.Errorf("ML analysis failed: %w", err)
	}

	// Process ML results
	for _, result := range mlResults {
		switch result.ModelType {
		case ml.ObjectDetection:
			frame.Metadata["objects"] = result.Predictions
		case ml.SceneClassification:
			frame.Metadata["scene"] = result.Predictions[0].Label
		case ml.FaceDetection:
			frame.Metadata["faces"] = result.Predictions
		}
	}

	// Store vector with real-time indexing
	if frame.Vector != nil {
		err = p.vectorIndex.Insert(ctx, &storage.VectorEntry{
			ID:        frame.ID,
			Vector:    frame.Vector,
			Metadata:  frame.Metadata,
			Timestamp: time.Now(),
		})
		if err != nil {
			return nil, fmt.Errorf("vector indexing failed: %w", err)
		}
	}

	result.Frame = frame
	return result, nil
}

// ExtractFrameBatch processes a batch of frames from a video
func (p *Processor) ExtractFrameBatch(ctx context.Context, videoPath string, videoID string, batchNum int) ([]ProcessResult, error) {
	// Calculate batch frame range
	startFrame := batchNum * p.config.BatchSize
	endFrame := startFrame + p.config.BatchSize

	// Extract frames for this batch
	framesDir := filepath.Join(filepath.Dir(videoPath), "frames", fmt.Sprintf("batch_%d", batchNum))
	extractedFrames, err := p.extractor.ExtractFrameRange(ctx, videoPath, framesDir, startFrame, endFrame)
	if err != nil {
		return nil, fmt.Errorf("batch extraction failed: %w", err)
	}

	var results []ProcessResult
	var wg sync.WaitGroup
	resultChan := make(chan ProcessResult, p.config.BatchSize)
	errorChan := make(chan error, p.config.BatchSize)
	sem := make(chan struct{}, p.config.MaxGoroutines)

	// Use extractedFrames instead of filepath.Glob
	for i, frame := range extractedFrames {
		wg.Add(1)
		sem <- struct{}{} // Acquire semaphore

		go func(frame ExtractionResult, frameNum int) {
			defer wg.Done()
			defer func() { <-sem }() // Release semaphore

			result, err := p.ProcessFrame(ctx, frame.FramePath, videoID, frameNum)
			if err != nil {
				errorChan <- err
				return
			}
			resultChan <- *result
		}(frame, startFrame+i)
	}

	go func() {
		wg.Wait()
		close(resultChan)
		close(errorChan)
	}()

	// Collect results and errors
	for result := range resultChan {
		results = append(results, result)
	}

	if len(errorChan) > 0 {
		var errStr string
		for err := range errorChan {
			errStr += err.Error() + "; "
		}
		return results, fmt.Errorf("batch processing errors: %s", errStr)
	}

	return results, nil
}

// AnalyzeFrameContent performs detailed analysis of frame content
func (p *Processor) AnalyzeFrameContent(framePath string) (map[string]interface{}, error) {
	// Open and decode image
	file, err := os.Open(framePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open frame: %w", err)
	}
	defer file.Close()

	img, _, err := image.Decode(file)
	if err != nil {
		return nil, fmt.Errorf("failed to decode frame: %w", err)
	}

	// Initialize metadata map
	metadata := make(map[string]interface{})

	// Analyze basic image properties
	bounds := img.Bounds()
	metadata["dimensions"] = map[string]int{
		"width":  bounds.Max.X,
		"height": bounds.Max.Y,
	}

	// Color analysis
	colorStats := p.analyzeColorDistribution(img)
	metadata["color_stats"] = colorStats

	// Edge detection (basic implementation)
	edgeScore := p.detectEdges(img)
	metadata["edge_score"] = edgeScore

	// Motion estimation (if previous frame available)
	// This would require maintaining state between frames
	metadata["motion_score"] = p.estimateMotion(img)

	return metadata, nil
}

// Helper methods for frame analysis
func (p *Processor) analyzeColorDistribution(img image.Image) map[string]interface{} {
	bounds := img.Bounds()
	var rTotal, gTotal, bTotal uint32
	pixelCount := bounds.Dx() * bounds.Dy()

	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			r, g, b, _ := img.At(x, y).RGBA()
			rTotal += r >> 8
			gTotal += g >> 8
			bTotal += b >> 8
		}
	}

	return map[string]interface{}{
		"average_rgb": map[string]float64{
			"r": float64(rTotal) / float64(pixelCount),
			"g": float64(gTotal) / float64(pixelCount),
			"b": float64(bTotal) / float64(pixelCount),
		},
	}
}

func (p *Processor) detectEdges(img image.Image) float64 {
	// Implement basic edge detection
	// This is a simplified version - consider using more sophisticated algorithms
	bounds := img.Bounds()
	var edgeStrength float64

	for y := bounds.Min.Y + 1; y < bounds.Max.Y-1; y++ {
		for x := bounds.Min.X + 1; x < bounds.Max.X-1; x++ {
			// Horizontal gradient
			r1, g1, b1, _ := img.At(x-1, y).RGBA()
			r2, g2, b2, _ := img.At(x+1, y).RGBA()

			diff := math.Abs(float64(r1-r2)) +
				math.Abs(float64(g1-g2)) +
				math.Abs(float64(b1-b2))

			edgeStrength += diff
		}
	}

	return edgeStrength / float64((bounds.Max.X-2)*(bounds.Max.Y-2))
}

func (p *Processor) estimateMotion(img image.Image) float64 {
	p.motionMutex.Lock()
	defer p.motionMutex.Unlock()

	if p.previousFrame == nil {
		p.previousFrame = img
		return 0.0
	}

	bounds := img.Bounds()
	width, height := bounds.Max.X, bounds.Max.Y

	var totalDiff float64
	blockSize := 16 // Size of blocks for motion estimation

	// Compare blocks between current and previous frame
	for y := 0; y < height-blockSize; y += blockSize {
		for x := 0; x < width-blockSize; x += blockSize {
			diff := p.compareBlocks(x, y, blockSize, img, p.previousFrame)
			totalDiff += diff
		}
	}

	// Update previous frame
	p.previousFrame = img

	// Normalize the difference
	normalizedDiff := totalDiff / float64((width/blockSize)*(height/blockSize))
	return normalizedDiff
}

func (p *Processor) compareBlocks(x, y, size int, current, previous image.Image) float64 {
	var diff float64

	for dy := 0; dy < size; dy++ {
		for dx := 0; dx < size; dx++ {
			px1 := current.At(x+dx, y+dy)
			px2 := previous.At(x+dx, y+dy)

			r1, g1, b1, _ := px1.RGBA()
			r2, g2, b2, _ := px2.RGBA()

			// Calculate color difference
			diff += math.Abs(float64(r1>>8-r2>>8)) +
				math.Abs(float64(g1>>8-g2>>8)) +
				math.Abs(float64(b1>>8-b2>>8))
		}
	}

	return diff / float64(size*size*3) // Normalize by block size and color channels
}
