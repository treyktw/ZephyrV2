// internal/models/frame.go
package models

import (
	"time"
)

type Frame struct {
	ID         string  `json:"id"`
	VideoID    string  `json:"video_id"`
	Number     int     `json:"frame_number"`
	Timestamp  float64 `json:"timestamp"`
	Path       string  `json:"path"`
	Resolution struct {
		Width  int `json:"width"`
		Height int `json:"height"`
	} `json:"resolution"`
	Quality  QualityMetrics         `json:"quality"`
	Vector   []float32              `json:"vector,omitempty"`
	Metadata map[string]interface{} // Change from json.RawMessage
	// Metadata  EnhancedMetadata `json:"metadata"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type QualityMetrics struct {
	Brightness float64 `json:"brightness"`
	Contrast   float64 `json:"contrast"`
	Sharpness  float64 `json:"sharpness"`
	Blur       float64 `json:"blur"`
	Score      float64 `json:"score"` // Overall quality score
}

type FrameBatch struct {
	VideoID     string
	Frames      []Frame
	BatchNumber int
	CreatedAt   time.Time
}

// Additional metadata models
type AdditionalFrameMetadata struct {
	Scene       string   `json:"scene"`
	Objects     []string `json:"objects,omitempty"`
	OCRText     string   `json:"ocr_text,omitempty"`
	Labels      []string `json:"labels,omitempty"`
	ColorScheme []string `json:"color_scheme,omitempty"`
}
