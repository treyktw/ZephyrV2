package models

type VideoStatus string

const (
	VideoStatusUploading  VideoStatus = "uploading"
	VideoStatusProcessing VideoStatus = "processing"
	VideoStatusComplete   VideoStatus = "complete"
	VideoStatusError      VideoStatus = "error"
)

type Video struct {
	ID           string         `json:"id"`
	Filename     string         `json:"filename"`
	Status       VideoStatus    `json:"status"`
	CreatedAt    int64          `json:"created_at"`
	UpdatedAt    int64          `json:"updated_at"`
	ErrorMessage *string        `json:"error_message,omitempty"`
	Metadata     *VideoMetadata `json:"metadata,omitempty"`
}

type VideoMetadata struct {
	Duration string  `json:"duration"`
	Size     int64   `json:"size"`
	Format   string  `json:"format"`
	Width    int     `json:"width"`
	Height   int     `json:"height"`
	Fps      float64 `json:"fps"`
}

type ProcessingStatus struct {
	Status           string `json:"status"`
	Progress         int    `json:"progress"`
	FramesProcessed  int    `json:"frames_processed"`
	CurrentTimestamp string `json:"current_timestamp"`
	StartedAt        int64  `json:"started_at"`
	LastUpdate       int64  `json:"last_update"`
}

type FrameMetadata struct {
	FrameNumber int    `json:"frame_number"`
	Timestamp   string `json:"timestamp"`
	Path        string `json:"path"`
	Size        int64  `json:"size"`
	Resolution  string `json:"resolution"`
}
