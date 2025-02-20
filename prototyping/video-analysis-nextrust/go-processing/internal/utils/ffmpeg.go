package utils

import (
	"encoding/json"
	"os/exec"
)

func CheckFFmpeg() error {
	cmd := exec.Command("ffmpeg", "-version")
	return cmd.Run()
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
