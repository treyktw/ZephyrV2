// internal/services/vector/clip.go
package vector

import (
	"context"
	"crypto/sha256"
	"fmt"
	"image"
	"math"
)

func (c *CLIPModel) GenerateEmbedding(ctx context.Context, img image.Image) ([]float32, error) {
	// Mock implementation that generates deterministic embeddings based on image properties
	bounds := img.Bounds()
	width, height := bounds.Max.X, bounds.Max.Y

	// Create a hash of basic image properties
	data := []byte(fmt.Sprintf("%dx%d", width, height))
	hash := sha256.Sum256([]byte(data))

	// Generate mock embedding
	embedding := make([]float32, c.info.OutputDim)
	for i := 0; i < c.info.OutputDim && i < len(hash); i++ {
		// Convert hash bytes to float32 values between -1 and 1
		value := float64(hash[i])/128.0 - 1.0
		embedding[i] = float32(value)
	}

	return normalizeVector(embedding), nil
}

func (c *CLIPModel) GenerateEmbeddingBatch(ctx context.Context, images []image.Image) ([][]float32, error) {
	vectors := make([][]float32, len(images))
	for i, img := range images {
		embedding, err := c.GenerateEmbedding(ctx, img)
		if err != nil {
			return nil, err
		}
		vectors[i] = embedding
	}
	return vectors, nil
}

// Helper function for vector normalization
func normalizeVector(vec []float32) []float32 {
	var sum float32
	for _, v := range vec {
		sum += v * v
	}
	norm := float32(math.Sqrt(float64(sum)))

	if norm == 0 {
		return vec
	}

	normalized := make([]float32, len(vec))
	for i, v := range vec {
		normalized[i] = v / norm
	}

	return normalized
}
