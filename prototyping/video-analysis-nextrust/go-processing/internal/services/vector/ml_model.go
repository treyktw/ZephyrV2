// internal/services/vector/model.go

package vector

import (
	"context"
	"image"
)

// Model defines the interface for ML models
type Model interface {
	GenerateEmbedding(ctx context.Context, img image.Image) ([]float32, error)
	GenerateEmbeddingBatch(ctx context.Context, images []image.Image) ([][]float32, error)
	ModelInfo() ModelInfo
}

type ModelInfo struct {
	Name      string
	Version   string
	InputDim  [3]int // [height, width, channels]
	OutputDim int    // embedding dimension
}

// CLIP model implementation
type CLIPModel struct {
	modelPath string
	device    string
	info      ModelInfo
}

func NewCLIPModel(modelPath string, useGPU bool) (*CLIPModel, error) {
	device := "CPU"
	if useGPU {
		device = "CUDA"
	}

	return &CLIPModel{
		modelPath: modelPath,
		device:    device,
		info: ModelInfo{
			Name:      "CLIP",
			Version:   "ViT-B/32",
			InputDim:  [3]int{224, 224, 3},
			OutputDim: 512,
		},
	}, nil
}

func (c *CLIPModel) VectorDimension() int {
	return c.info.OutputDim
}

func (c *CLIPModel) ModelInfo() ModelInfo {
	return c.info
}
