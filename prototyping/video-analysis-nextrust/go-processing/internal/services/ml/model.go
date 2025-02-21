// internal/services/ml/model.go
package ml

import (
	"context"
	"image"
	"sync"
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
