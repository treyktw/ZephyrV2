// internal/config/config.go
package config

import (
	"os"
	"path/filepath"
	"strconv"
	"zephyrV2/internal/services/frame"
	"zephyrV2/internal/services/storage"

	"github.com/joho/godotenv"
)

type Config struct {
	RedisURL    string
	UploadsDir  string
	FramesDir   string
	FrameRate   float64
	JpegQuality int
}

type ProcessorConfigVideo struct {
	UploadsDir      string
	FramesDir       string
	RedisClient     *storage.RedisClient
	ExtractorConfig frame.ExtractorConfig
}

func Load() *Config {
	godotenv.Load() // Load .env file if it exists

	currentDir, err := os.Getwd()
	if err != nil {
		panic(err)
	}
	projectRoot := filepath.Dir(filepath.Dir(currentDir))

	return &Config{
		RedisURL:    getEnv("REDIS_URL", "redis://localhost:6379"),
		UploadsDir:  filepath.Join(projectRoot, "data", "videos"),
		FramesDir:   filepath.Join(projectRoot, "data", "frames"),
		FrameRate:   getEnvFloat("FRAME_RATE", 1.0),
		JpegQuality: getEnvInt("JPEG_QUALITY", 2),
	}
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}

func getEnvFloat(key string, fallback float64) float64 {
	strValue, exists := os.LookupEnv(key)
	if !exists {
		return fallback
	}

	value, err := strconv.ParseFloat(strValue, 64)
	if err != nil {
		return fallback
	}
	return value
}

func getEnvInt(key string, fallback int) int {
	strValue, exists := os.LookupEnv(key)
	if !exists {
		return fallback
	}

	value, err := strconv.Atoi(strValue)
	if err != nil {
		return fallback
	}
	return value
}
