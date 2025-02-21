package utils

import (
	"encoding/json"
	"fmt"
	"image"
	"os"
	"os/exec"

	"github.com/google/uuid"
)

type FFmpeg struct {
	// Add any configuration if needed
}

func NewFFmpeg() *FFmpeg {
	return &FFmpeg{}
}

func CheckFFmpeg() error {
	cmd := exec.Command("ffmpeg", "-version")
	return cmd.Run()
}

func LoadImage(path string) (image.Image, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("failed to open image: %w", err)
	}
	defer file.Close()

	img, _, err := image.Decode(file)
	if err != nil {
		return nil, fmt.Errorf("failed to decode image: %w", err)
	}

	return img, nil
}

func GetVideoInfo(path string) (map[string]interface{}, error) {
	cmd := exec.Command(
		"ffprobe",
		"-v", "quiet",
		"-print_format", "json",
		"-show_format",
		"-show_streams",
		path,
	)

	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	var info map[string]interface{}
	if err := json.Unmarshal(output, &info); err != nil {
		return nil, err
	}

	return info, nil
}

func GenerateUUID() string {
	return uuid.New().String()
}
