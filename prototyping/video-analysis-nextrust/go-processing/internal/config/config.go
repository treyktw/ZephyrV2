// internal/config/config.go
package config

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"time"
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
	SingleStore SingleStoreConfig // Add this1
}

type SingleStoreConfig struct {
	URL             string
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime int
}

type ProcessorConfigVideo struct {
	UploadsDir      string
	FramesDir       string
	RedisClient     *storage.RedisClient
	ExtractorConfig frame.ExtractorConfig
}

func (c *SingleStoreConfig) Validate() error {
	if c.URL == "" {
		return fmt.Errorf("SingleStore URL cannot be empty")
	}
	if c.MaxOpenConns <= 0 {
		return fmt.Errorf("MaxOpenConns must be greater than 0")
	}
	if c.MaxIdleConns <= 0 {
		return fmt.Errorf("MaxIdleConns must be greater than 0")
	}
	if c.ConnMaxLifetime <= 0 {
		return fmt.Errorf("ConnMaxLifetime must be greater than 0")
	}
	return nil
}

func (c *SingleStoreConfig) TestConnection(ctx context.Context) error {
	db, err := sql.Open("mysql", c.URL)
	if err != nil {
		return fmt.Errorf("failed to create SingleStore connection: %w", err)
	}
	defer db.Close()

	// Configure connection pool
	db.SetMaxOpenConns(c.MaxOpenConns)
	db.SetMaxIdleConns(c.MaxIdleConns)
	db.SetConnMaxLifetime(time.Duration(c.ConnMaxLifetime) * time.Second)

	// Test connection
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		return fmt.Errorf("failed to ping SingleStore: %w", err)
	}

	// Test query
	var result int
	if err := db.QueryRowContext(ctx, "SELECT 1").Scan(&result); err != nil {
		return fmt.Errorf("failed to execute test query: %w", err)
	}

	return nil
}

func (c *Config) Validate() error {
	if c.RedisURL == "" {
		return fmt.Errorf("redis URL cannot be empty")
	}
	if c.UploadsDir == "" {
		return fmt.Errorf("UploadsDir cannot be empty")
	}
	if c.FramesDir == "" {
		return fmt.Errorf("FramesDir cannot be empty")
	}
	if c.FrameRate <= 0 {
		return fmt.Errorf("FrameRate must be greater than 0")
	}
	if c.JpegQuality <= 0 || c.JpegQuality > 100 {
		return fmt.Errorf("JpegQuality must be between 1 and 100")
	}
	return c.SingleStore.Validate()
}

func Load() *Config {
	godotenv.Load()

	currentDir, err := os.Getwd()
	if err != nil {
		panic(err)
	}
	projectRoot := filepath.Dir(filepath.Dir(currentDir))

	// Format MySQL connection string for Go's MySQL driver
	singlestoreURL := fmt.Sprintf(
		"%s:%s@tcp(%s:%s)/%s", // Changed format here
		getEnv("SINGLESTORE_USER", "root"),
		getEnv("SINGLESTORE_PASSWORD", "password"),
		getEnv("SINGLESTORE_HOST", "127.0.0.1"),
		getEnv("SINGLESTORE_PORT", "3306"),
		getEnv("SINGLESTORE_DATABASE", "video_analysis"),
	)

	return &Config{
		RedisURL:    getEnv("REDIS_URL", "redis://localhost:6379"),
		UploadsDir:  filepath.Join(projectRoot, "data", "videos"),
		FramesDir:   filepath.Join(projectRoot, "data", "frames"),
		FrameRate:   getEnvFloat("FRAME_RATE", 1.0),
		JpegQuality: getEnvInt("JPEG_QUALITY", 2),
		SingleStore: SingleStoreConfig{
			URL:             singlestoreURL,
			MaxOpenConns:    getEnvInt("SINGLESTORE_MAX_OPEN_CONNS", 10),
			MaxIdleConns:    getEnvInt("SINGLESTORE_MAX_IDLE_CONNS", 10),
			ConnMaxLifetime: getEnvInt("SINGLESTORE_CONN_MAX_LIFETIME", 300),
		},
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

func (c *Config) TestConnections(ctx context.Context) error {
	// Test Redis connection
	redisClient, err := storage.NewRedisClient(c.RedisURL)
	if err != nil {
		return fmt.Errorf("failed to connect to Redis: %w", err)
	}
	defer redisClient.Client.Close()

	// Test SingleStore connection
	if err := c.SingleStore.TestConnection(ctx); err != nil {
		return err
	}

	return nil
}
