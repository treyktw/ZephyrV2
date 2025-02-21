// internal/models/metadata.go
package models

// Basic types for detections
type DetectedObject struct {
	Label       string                 `json:"label"`
	Confidence  float64                `json:"confidence"`
	BoundingBox Box                    `json:"bounding_box"`
	Attributes  map[string]interface{} `json:"attributes,omitempty"`
}

type Box struct {
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

type SceneInfo struct {
	Label      string                 `json:"label"`
	Confidence float64                `json:"confidence"`
	Attributes map[string]interface{} `json:"attributes,omitempty"`
	TimeRange  TimeRange              `json:"time_range,omitempty"`
}

type OCRInfo struct {
	Content    string      `json:"content"`
	Confidence float64     `json:"confidence"`
	Blocks     []TextBlock `json:"blocks"`
	Language   string      `json:"language,omitempty"`
}

type TextBlock struct {
	Text       string  `json:"text"`
	Box        Box     `json:"box"`
	LineNum    int     `json:"line_num"`
	WordNum    int     `json:"word_num"`
	Confidence float64 `json:"confidence"`
}

type FaceInfo struct {
	BoundingBox Box            `json:"bounding_box"`
	Confidence  float64        `json:"confidence"`
	Landmarks   []Landmark     `json:"landmarks,omitempty"`
	Attributes  FaceAttributes `json:"attributes,omitempty"`
}

type Landmark struct {
	Type string  `json:"type"`
	X    float64 `json:"x"`
	Y    float64 `json:"y"`
}

type FaceAttributes struct {
	Age        float64 `json:"age"`
	Gender     string  `json:"gender"`
	Expression string  `json:"expression"`
	Pose       Pose    `json:"pose"`
}

type Pose struct {
	Pitch float64 `json:"pitch"`
	Roll  float64 `json:"roll"`
	Yaw   float64 `json:"yaw"`
}

type TimeRange struct {
	Start float64 `json:"start"`
	End   float64 `json:"end"`
}

// RelationshipType defines the type of relationship between videos
type RelationshipType string

// Define constants for relationship types
const (
	RelationshipTypeSimilar     RelationshipType = "similar"
	RelationshipTypeSequential  RelationshipType = "sequential"
	RelationshipTypeScene       RelationshipType = "scene"
	RelationshipTypeObjectBased RelationshipType = "object_based"
)

// Configuration for relationship tracking
type RelationshipConfig struct {
	MaxSimilarFrames     int                `json:"max_similar_frames"`
	SimilarityThreshold  float64            `json:"similarity_threshold"`
	TemporalWindow       int                `json:"temporal_window"` // Number of frames to consider before/after
	SceneChangeThreshold float64            `json:"scene_change_threshold"`
	EnabledTypes         []RelationshipType `json:"enabled_types"`
}

// Now let's update the EnhancedMetadata struct
type EnhancedMetadata struct {
	Basic struct {
		Resolution string  `json:"resolution"`
		Format     string  `json:"format"`
		Size       int64   `json:"size"`
		Duration   float64 `json:"duration"`
	} `json:"basic"`

	Analysis struct {
		Objects []DetectedObject `json:"objects,omitempty"`
		Scenes  []SceneInfo      `json:"scenes,omitempty"`
		Text    *OCRInfo         `json:"text,omitempty"`
		Faces   []FaceInfo       `json:"faces,omitempty"`
	} `json:"analysis"`

	Vectors struct {
		Image    []float32 `json:"image,omitempty"`
		Text     []float32 `json:"text,omitempty"`
		Combined []float32 `json:"combined,omitempty"`
	} `json:"vectors"`

	Relationships struct {
		Similar     []string `json:"similar,omitempty"`
		Sequential  []string `json:"sequential,omitempty"`
		Scene       []string `json:"scene,omitempty"`
		ObjectBased []string `json:"object_based,omitempty"`
	} `json:"relationships"`

	Metrics struct {
		Quality   float64 `json:"quality"`
		Relevance float64 `json:"relevance"`
		Novelty   float64 `json:"novelty"`
	} `json:"metrics"`
}

// Helper functions for metadata conversion
func MetadataToEnhanced(metadata map[string]interface{}) *EnhancedMetadata {
	enhanced := &EnhancedMetadata{}

	// Extract relationships if they exist
	if rels, ok := metadata["relationships"].(map[string]interface{}); ok {
		if similar, ok := rels["similar"].([]string); ok {
			enhanced.Relationships.Similar = similar
		}
		if sequential, ok := rels["sequential"].([]string); ok {
			enhanced.Relationships.Sequential = sequential
		}
		if scene, ok := rels["scene"].([]string); ok {
			enhanced.Relationships.Scene = scene
		}
	}

	return enhanced
}

func EnhancedToMetadata(enhanced *EnhancedMetadata) map[string]interface{} {
	metadata := make(map[string]interface{})

	// Convert relationships
	relationships := make(map[string]interface{})
	relationships["similar"] = enhanced.Relationships.Similar
	relationships["sequential"] = enhanced.Relationships.Sequential
	relationships["scene"] = enhanced.Relationships.Scene

	metadata["relationships"] = relationships

	return metadata
}
