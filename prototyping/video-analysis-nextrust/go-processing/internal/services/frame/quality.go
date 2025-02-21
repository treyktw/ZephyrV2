// internal/services/frame/quality.go
package frame

import (
	"image"
	_ "image/jpeg"
	"math"
	"os"
	"zephyrV2/internal/models"
)

type QualityAnalyzer struct {
	// Add any configuration or dependencies here
}

func NewQualityAnalyzer() *QualityAnalyzer {
	return &QualityAnalyzer{}
}

func (qa *QualityAnalyzer) AnalyzeFrame(path string) (models.QualityMetrics, error) {
	f, err := os.Open(path)
	if err != nil {
		return models.QualityMetrics{}, err
	}
	defer f.Close()

	img, _, err := image.Decode(f)
	if err != nil {
		return models.QualityMetrics{}, err
	}

	metrics := models.QualityMetrics{}

	// Calculate brightness
	metrics.Brightness = qa.calculateBrightness(img)

	// Calculate contrast
	metrics.Contrast = qa.calculateContrast(img)

	// Calculate sharpness
	metrics.Sharpness = qa.calculateSharpness(img)

	// Calculate blur detection
	metrics.Blur = qa.detectBlur(img)

	// Calculate overall quality score
	metrics.Score = qa.calculateOverallScore(metrics)

	return metrics, nil
}

func (qa *QualityAnalyzer) calculateBrightness(img image.Image) float64 {
	bounds := img.Bounds()
	width, height := bounds.Max.X, bounds.Max.Y
	var totalBrightness float64

	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			r, g, b, _ := img.At(x, y).RGBA()
			// Convert to 0-255 range
			brightness := (float64(r>>8) + float64(g>>8) + float64(b>>8)) / 3.0
			totalBrightness += brightness
		}
	}

	return totalBrightness / float64(width*height) / 255.0
}

func (qa *QualityAnalyzer) calculateContrast(img image.Image) float64 {
	bounds := img.Bounds()
	width, height := bounds.Max.X, bounds.Max.Y

	// Calculate mean brightness first
	meanBrightness := qa.calculateBrightness(img)
	var variance float64

	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			r, g, b, _ := img.At(x, y).RGBA()
			brightness := (float64(r>>8) + float64(g>>8) + float64(b>>8)) / 3.0 / 255.0
			diff := brightness - meanBrightness
			variance += diff * diff
		}
	}

	return math.Sqrt(variance / float64(width*height))
}

func (qa *QualityAnalyzer) calculateSharpness(img image.Image) float64 {
	bounds := img.Bounds()
	width, height := bounds.Max.X, bounds.Max.Y
	var edgeStrength float64

	// Simple edge detection using horizontal gradient
	for y := 0; y < height; y++ {
		for x := 0; x < width-1; x++ {
			r1, g1, b1, _ := img.At(x, y).RGBA()
			r2, g2, b2, _ := img.At(x+1, y).RGBA()

			diff := math.Abs(float64(r1>>8)-float64(r2>>8)) +
				math.Abs(float64(g1>>8)-float64(g2>>8)) +
				math.Abs(float64(b1>>8)-float64(b2>>8))

			edgeStrength += diff
		}
	}

	return edgeStrength / float64(width*height*3)
}

func (qa *QualityAnalyzer) detectBlur(img image.Image) float64 {
	// Implement Laplacian variance for blur detection
	// Higher values indicate less blur
	bounds := img.Bounds()
	width, height := bounds.Max.X, bounds.Max.Y
	var laplacianVar float64

	// Simplified Laplacian calculation
	for y := 1; y < height-1; y++ {
		for x := 1; x < width-1; x++ {
			center := qa.getBrightness(img, x, y)
			surrounding := qa.getBrightness(img, x-1, y) +
				qa.getBrightness(img, x+1, y) +
				qa.getBrightness(img, x, y-1) +
				qa.getBrightness(img, x, y+1)

			laplacian := math.Abs(center*4 - surrounding)
			laplacianVar += laplacian * laplacian
		}
	}

	return laplacianVar / float64((width-2)*(height-2))
}

func (qa *QualityAnalyzer) getBrightness(img image.Image, x, y int) float64 {
	r, g, b, _ := img.At(x, y).RGBA()
	return (float64(r>>8) + float64(g>>8) + float64(b>>8)) / 3.0
}

func (qa *QualityAnalyzer) calculateOverallScore(metrics models.QualityMetrics) float64 {
	// Weights for different metrics
	weights := struct {
		brightness float64
		contrast   float64
		sharpness  float64
		blur       float64
	}{
		brightness: 0.25,
		contrast:   0.25,
		sharpness:  0.25,
		blur:       0.25,
	}

	score := metrics.Brightness*weights.brightness +
		metrics.Contrast*weights.contrast +
		metrics.Sharpness*weights.sharpness +
		(1-metrics.Blur)*weights.blur

	return math.Min(1.0, math.Max(0.0, score))
}
