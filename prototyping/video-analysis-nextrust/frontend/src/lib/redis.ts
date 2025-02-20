// src/lib/redis.ts
import { createClient } from 'redis';

const getRedisClient = () => {
  const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });

  client.on('error', (err: unknown) => console.error('Redis Client Error', err));

  return client;
};

// Create a singleton instance
const globalForRedis = globalThis as unknown as {
  redis: ReturnType<typeof createClient> | undefined;
};

export const redis = globalForRedis.redis ?? getRedisClient();

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

// Connect on first use
redis.connect().catch(console.error);
