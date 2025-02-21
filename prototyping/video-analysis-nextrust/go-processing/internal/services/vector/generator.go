// internal/services/vector/generator.go

package vector

import (
	"context"
	"fmt"
	"image"
	"os"
	"zephyrV2/internal/models"
)

type GeneratorConfig struct {
	BatchSize    int
	ModelType    string // e.g., "clip", "resnet", etc.
	VectorSize   int    // Size of output embedding
	UseGPU       bool
	MaxBatchSize int
}

type Generator struct {
	config  GeneratorConfig
	model   Model // Interface to ML model
	storage VectorStorage
	// mutex   sync.Mutex
}

func NewGenerator(config GeneratorConfig, model Model, storage VectorStorage) *Generator {
	return &Generator{
		config:  config,
		model:   model,
		storage: storage,
	}
}

// GenerateVector creates embedding for a single frame
func (g *Generator) GenerateVector(ctx context.Context, framePath string) ([]float32, error) {
	img, err := loadImage(framePath)
	if err != nil {
		return nil, fmt.Errorf("failed to load image: %w", err)
	}

	// Generate embedding using the ML model
	vector, err := g.model.GenerateEmbedding(ctx, img)
	if err != nil {
		return nil, fmt.Errorf("failed to generate embedding: %w", err)
	}

	return vector, nil
}

// GenerateVectorBatch processes multiple frames in batch
func (g *Generator) GenerateVectorBatch(ctx context.Context, frames []models.Frame) ([]models.Frame, error) {
	batchSize := min(len(frames), g.config.MaxBatchSize)
	results := make([]models.Frame, len(frames))

	for i := 0; i < len(frames); i += batchSize {
		end := min(i+batchSize, len(frames))
		batch := frames[i:end]

		// Prepare batch of images
		images := make([]image.Image, len(batch))
		for j, frame := range batch {
			img, err := loadImage(frame.Path)
			if err != nil {
				return nil, fmt.Errorf("failed to load image %s: %w", frame.Path, err)
			}
			images[j] = img
		}

		// Generate embeddings for batch
		vectors, err := g.model.GenerateEmbeddingBatch(ctx, images)
		if err != nil {
			return nil, fmt.Errorf("batch embedding generation failed: %w", err)
		}

		// Store vectors and update frames
		for j, vector := range vectors {
			batch[j].Vector = vector
			results[i+j] = batch[j]
			// Store vector in database
			metadata := batch[j].Metadata
			if err := g.storage.StoreVector(ctx, batch[j].ID, vector, metadata); err != nil {
				return nil, fmt.Errorf("failed to store vector: %w", err)
			}
		}
	}

	return results, nil
}

// Helper functions
func loadImage(path string) (image.Image, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	img, _, err := image.Decode(file)
	if err != nil {
		return nil, err
	}

	return img, nil
}
