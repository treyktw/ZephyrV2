// internal/services/ocr/service.go
package ocr

import (
	"bytes"
	"context"
	"image"
	"image/png"

	"github.com/otiai10/gosseract/v2"
)

type OCRService struct {
	client *gosseract.Client
	config OCRConfig
}

type OCRConfig struct {
	Languages   []string
	PageSegMode int
	Debug       bool
}

type OCRResult struct {
	Text       string
	Confidence float64
	Blocks     []TextBlock
	Embedding  []float32 // Text embedding vector
}

type TextBlock struct {
	Text    string
	Box     image.Rectangle
	LineNum int
	WordNum int
}

func NewOCRService(config OCRConfig) (*OCRService, error) {
	client := gosseract.NewClient()

	// Configure languages
	if err := client.SetLanguage(config.Languages...); err != nil {
		return nil, err
	}

	return &OCRService{
		client: client,
		config: config,
	}, nil
}

func (s *OCRService) ProcessImage(ctx context.Context, img image.Image) (*OCRResult, error) {
	// Extract text from image
	if err := s.client.SetImageFromBytes(imageToBytes(img)); err != nil {
		return nil, err
	}

	text, err := s.client.Text()
	if err != nil {
		return nil, err
	}

	// Get text blocks with position information
	boxes, err := s.client.GetBoundingBoxes(gosseract.RIL_BLOCK)
	if err != nil {
		return nil, err
	}

	var textBlocks []TextBlock
	for i, box := range boxes {
		textBlocks = append(textBlocks, TextBlock{
			Text:    box.Word,
			Box:     image.Rect(box.Box.Min.X, box.Box.Min.Y, box.Box.Max.X, box.Box.Max.Y),
			LineNum: i,
		})
	}

	// Generate text embedding
	embedding, err := s.generateTextEmbedding(text)
	if err != nil {
		return nil, err
	}

	return &OCRResult{
		Text:       text,
		Confidence: 0, // Confidence score not available in gosseract
		Blocks:     textBlocks,
		Embedding:  embedding,
	}, nil
}

func (s *OCRService) generateTextEmbedding(text string) ([]float32, error) {
	// Use a text embedding model (e.g., BERT, USE)
	// This is a placeholder - implement with your chosen embedding model
	return nil, nil
}

func imageToBytes(img image.Image) []byte {
	buf := new(bytes.Buffer)
	_ = png.Encode(buf, img)
	return buf.Bytes()
}
