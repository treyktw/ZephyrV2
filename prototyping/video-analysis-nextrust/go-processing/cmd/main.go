package main

import (
	"context"
	"database/sql"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"zephyrV2/internal/config"
	"zephyrV2/internal/services/frame"
	"zephyrV2/internal/services/ml"
	"zephyrV2/internal/services/storage"
	"zephyrV2/internal/services/vector"
	"zephyrV2/internal/services/video"
	"zephyrV2/internal/utils"
)

type SingleStoreDB struct {
	DB *sql.DB
}

func main() {
	// Setup logging with timestamp and file info
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Println("Starting video processor service...")

	// Check for FFmpeg installation
	if err := utils.CheckFFmpeg(); err != nil {
		log.Fatalf("FFmpeg is not installed or not accessible: %v", err)
	}

	// Load configuration
	cfg := config.Load()

	// Log config values
	log.Printf("Configuration loaded: \n"+
		"Redis URL: %s\n"+
		"SingleStore URL: %s\n"+
		"Uploads Directory: %s\n"+
		"Frames Directory: %s\n",
		cfg.RedisURL,
		cfg.SingleStore.URL,
		cfg.UploadsDir,
		cfg.FramesDir,
	)

	// Create required directories
	for _, dir := range []string{cfg.UploadsDir, cfg.FramesDir} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			log.Fatalf("Failed to create directory %s: %v", dir, err)
		}
	}

	// Initialize Redis client with retry
	var redis *storage.RedisClient
	var err error
	for attempts := 1; attempts <= 5; attempts++ {
		redis, err = storage.NewRedisClient(cfg.RedisURL)
		if err == nil {
			break
		}
		log.Printf("Failed to connect to Redis (attempt %d/5): %v", attempts, err)
		time.Sleep(time.Second * 2)
	}
	if err != nil {
		log.Fatalf("Failed to connect to Redis after 5 attempts: %v", err)
	}
	log.Println("Successfully connected to Redis")

	// Initialize SingleStore connection
	log.Println("Connecting to SingleStore...")
	db, err := sql.Open("mysql", cfg.SingleStore.URL)
	if err != nil {
		log.Fatalf("Failed to create SingleStore connection: %v", err)
	}
	defer db.Close()

	singleStoreDB := storage.NewSingleStoreDBWithConnection(db)
	if err != nil {
		log.Fatalf("Failed to initialize SingleStore: %v", err)
	}

	// Create vector configuration
	vectorConfig := vector.GeneratorConfig{
		BatchSize:    100,
		VectorSize:   384,
		UseGPU:       false,
		MaxBatchSize: 32,
	}

	// Initialize dependencies for frame processor
	processorConfig := frame.ProcessorConfig{
		BatchSize:        100,
		MaxGoroutines:    4,
		QualityThreshold: 0.7,
		FrameRate:        cfg.FrameRate,
	}

	vectorIndex := storage.NewVectorIndex(singleStoreDB, 100, 5*time.Second)
	modelManager := ml.NewModelManager(10)
	vectorGen := vector.NewGenerator(vectorConfig, modelManager, vectorIndex)

	// Initialize frame processor
	frameProcessor := frame.NewProcessor(processorConfig, vectorGen, modelManager, vectorIndex)

	// Initialize frame processor
	// Initialize video service with both Redis and SingleStore
	videoService, err := video.NewVideoService(
		cfg.UploadsDir,
		cfg.FramesDir,
		redis,
		cfg.FrameRate,
		cfg.JpegQuality,
		db, // SingleStore connection
		frameProcessor,
	)
	log.Printf("Video service initialized with uploads dir: %s, frames dir: %s",
		cfg.UploadsDir,
		cfg.FramesDir,
	)

	// Create context with cancellation
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Error channel for service errors
	errChan := make(chan error, 1)

	// Start processing in goroutine
	go func() {
		if err := videoService.StartProcessing(ctx); err != nil {
			errChan <- err
		}
	}()

	// Set up signal handling
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Wait for shutdown signal or error
	select {
	case err := <-errChan:
		log.Printf("Service error: %v", err)
	case sig := <-sigChan:
		log.Printf("Received signal: %v", sig)
	}

	// Graceful shutdown
	log.Println("Initiating graceful shutdown...")

	// Create a timeout context for shutdown
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	// Cancel the main context to stop new processing
	cancel()

	// Wait for ongoing processing to complete or timeout
	select {
	case <-shutdownCtx.Done():
		log.Println("Shutdown timeout reached, forcing exit")
	case <-time.After(100 * time.Millisecond):
		log.Println("Shutdown completed successfully")
	}

	log.Println("Service stopped")
}
