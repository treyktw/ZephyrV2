package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"zephyrV2/internal/models"

	"github.com/redis/go-redis/v9"
)

type RedisClient struct {
	Client *redis.Client
}

func NewRedisClient(redisURL string) (*RedisClient, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse Redis URL: %w", err)
	}

	client := redis.NewClient(opts)

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	return &RedisClient{
		Client: client,
	}, nil
}

func (r *RedisClient) GetVideo(ctx context.Context, id string) (*models.Video, error) {
	videoJSON, err := r.Client.Get(ctx, fmt.Sprintf("video:%s", id)).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, fmt.Errorf("video not found: %s", id)
		}
		return nil, fmt.Errorf("failed to get video from Redis: %w", err)
	}

	var video models.Video
	if err := json.Unmarshal([]byte(videoJSON), &video); err != nil {
		return nil, fmt.Errorf("failed to unmarshal video: %w", err)
	}

	return &video, nil
}

func (r *RedisClient) UpdateVideo(ctx context.Context, video *models.Video) error {
	videoJSON, err := json.Marshal(video)
	if err != nil {
		return fmt.Errorf("failed to marshal video: %w", err)
	}

	if err := r.Client.Set(ctx, fmt.Sprintf("video:%s", video.ID), videoJSON, 0).Err(); err != nil {
		return fmt.Errorf("failed to update video in Redis: %w", err)
	}

	return nil
}

func (r *RedisClient) WatchNewVideos(ctx context.Context) (<-chan string, error) {
	videoChan := make(chan string)

	go func() {
		defer close(videoChan)

		for {
			select {
			case <-ctx.Done():
				return
			default:
				// Try to get new video from Redis list
				result, err := r.Client.BLPop(ctx, 0, "video_queue").Result()
				if err != nil {
					if err != context.Canceled {
						fmt.Printf("Error watching videos: %v\n", err)
					}
					return
				}

				if len(result) > 1 {
					videoChan <- result[1] // result[0] is key name, result[1] is value
				}
			}
		}
	}()

	return videoChan, nil
}
