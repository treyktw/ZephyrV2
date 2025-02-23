// internal/services/ml/model.go
package ml

import (
	"context"
	"fmt"
	"image"
	"sync"
	"zephyrV2/internal/services/vector"
)

type ModelType string

const (
	ObjectDetection     ModelType = "object_detection"
	SceneClassification ModelType = "scene_classification"
	FaceDetection       ModelType = "face_detection"
	ActionRecognition   ModelType = "action_recognition"
)

type Model interface {
	Predict(ctx context.Context, img image.Image) ([]Prediction, error)
}

type ModelResult struct {
	ModelType      ModelType
	Predictions    []Prediction
	Error          error
	ProcessingTime float64
}

type Prediction struct {
	Label       string
	Confidence  float64
	BoundingBox *BoundingBox // For object detection
	Attributes  map[string]interface{}
}

type BoundingBox struct {
	X, Y, Width, Height float64
}

type ModelManager struct {
	models    map[ModelType]Model
	mutex     sync.RWMutex
	batchSize int
}

type ModelInfo struct {
	Name      string
	Version   string
	InputDim  [3]int // [height, width, channels]
	OutputDim int    // embedding dimension
}

func NewModelManager(batchSize int) *ModelManager {
	return &ModelManager{
		models:    make(map[ModelType]Model),
		batchSize: batchSize,
	}
}

func (mm *ModelManager) RegisterModel(modelType ModelType, model Model) {
	mm.mutex.Lock()
	defer mm.mutex.Unlock()
	mm.models[modelType] = model
}

func (mm *ModelManager) AnalyzeFrame(ctx context.Context, img image.Image) ([]ModelResult, error) {
	mm.mutex.RLock()
	defer mm.mutex.RUnlock()

	var wg sync.WaitGroup
	results := make([]ModelResult, 0, len(mm.models))
	resultChan := make(chan ModelResult, len(mm.models))

	for modelType, model := range mm.models {
		wg.Add(1)
		go func(mType ModelType, m Model) {
			defer wg.Done()

			result := ModelResult{ModelType: mType}
			predictions, err := m.Predict(ctx, img)
			if err != nil {
				result.Error = err
			} else {
				result.Predictions = predictions
			}
			resultChan <- result
		}(modelType, model)
	}

	go func() {
		wg.Wait()
		close(resultChan)
	}()

	for result := range resultChan {
		results = append(results, result)
	}

	return results, nil
}

func (mm *ModelManager) GenerateEmbedding(ctx context.Context, img image.Image) ([]float32, error) {
	results, err := mm.AnalyzeFrame(ctx, img)
	if err != nil {
		return nil, fmt.Errorf("failed to analyze frame: %w", err)
	}

	// Combine predictions into a feature vector
	// This is a simplified example - you'd want to implement proper feature extraction
	vector := make([]float32, 384) // Standard embedding size

	var idx int
	for _, result := range results {
		for _, pred := range result.Predictions {
			// Add confidence scores to vector
			if idx < len(vector) {
				vector[idx] = float32(pred.Confidence)
				idx++
			}
		}
	}

	return vector, nil
}

func (mm *ModelManager) GenerateEmbeddingBatch(ctx context.Context, images []image.Image) ([][]float32, error) {
	vectors := make([][]float32, len(images))

	// Process in batches
	for i := 0; i < len(images); i += mm.batchSize {
		end := min(i+mm.batchSize, len(images))
		batch := images[i:end]

		// Process each image in the batch
		for j, img := range batch {
			vector, err := mm.GenerateEmbedding(ctx, img)
			if err != nil {
				return nil, fmt.Errorf("failed to generate embedding for image %d: %w", i+j, err)
			}
			vectors[i+j] = vector
		}
	}

	return vectors, nil
}

func (mm *ModelManager) ModelInfo() vector.ModelInfo {
	return vector.ModelInfo{
		Name:      "ModelManager",
		Version:   "1.0",
		InputDim:  [3]int{224, 224, 3},
		OutputDim: 384,
	}
}

// Helper function for min
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
