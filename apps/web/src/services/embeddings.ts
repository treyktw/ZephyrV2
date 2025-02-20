// lib/services/embeddings.ts

import { redis } from '@/db';
import crypto from 'crypto';
import { encode } from 'gpt-tokenizer';

type EmbeddingProvider = 'openai' | 'local' | 'huggingface';

interface EmbeddingOptions {
  provider?: EmbeddingProvider;
  cacheDuration?: number; // in seconds
  useCache?: boolean;
}

export class EmbeddingService {
  private static instance: EmbeddingService;
  private readonly defaultOptions: EmbeddingOptions = {
    provider: 'openai',
    cacheDuration: 24 * 60 * 60, // 24 hours
    useCache: true
  };

  private constructor() {}

  static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService();
    }
    return EmbeddingService.instance;
  }

  async generateEmbedding(text: string, options?: EmbeddingOptions): Promise<number[]> {
    const finalOptions = { ...this.defaultOptions, ...options };

    // Generate cache key
    const cacheKey = this.generateCacheKey(text);

    // Try to get from cache if enabled
    if (finalOptions.useCache) {
      const cached = await this.getCachedEmbedding(cacheKey);
      if (cached) return cached;
    }

    // Generate new embedding
    const embedding = await this.getEmbeddingFromProvider(text, finalOptions.provider!);

    // Cache the result if caching is enabled
    if (finalOptions.useCache) {
      await this.cacheEmbedding(cacheKey, embedding, finalOptions.cacheDuration!);
    }

    return embedding;
  }

  private generateCacheKey(text: string): string {
    return crypto
      .createHash('sha256')
      .update(text)
      .digest('hex');
  }

  private async getCachedEmbedding(key: string): Promise<number[] | null> {
    try {
      const cached = await redis.get(`embedding:${key}`);
      if (cached) {
        return JSON.parse(cached as string);
      }
      return null;
    } catch (error) {
      console.error('Error getting cached embedding:', error);
      return null;
    }
  }

  private async cacheEmbedding(key: string, embedding: number[], duration: number): Promise<void> {
    try {
      await redis.set(
        `embedding:${key}`,
        JSON.stringify(embedding),
        { ex: duration }
      );
    } catch (error) {
      console.error('Error caching embedding:', error);
    }
  }

  private async getEmbeddingFromProvider(text: string, provider: EmbeddingProvider): Promise<number[]> {
    switch (provider) {
      case 'openai':
        return await this.getOpenAIEmbedding(text);
      case 'local':
        return await this.getLocalEmbedding(text);
      // case 'huggingface':
      //   return await this.getHuggingFaceEmbedding(text);
      default:
        throw new Error(`Unsupported embedding provider: ${provider}`);
    }
  }

  private async getOpenAIEmbedding(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        input: text,
        model: 'text-embedding-ada-002'
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  private async getLocalEmbedding(text: string): Promise<number[]> {
    // Simplified token-based embedding for demonstration
    // In production, you'd want to use a proper local embedding model
    const tokens = encode(text);
    const dimension = 1536; // Same as OpenAI's ada-002
    const embedding = new Array(dimension).fill(0);

    tokens.forEach((token: number, i: number) => {
      const position = token % dimension;
      embedding[position] = (embedding[position] + token) / (i + 1);
    });

    // Normalize the embedding
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
  }

  // private async getHuggingFaceEmbedding(text: string): Promise<number[]> {
  //   // Implementation for HuggingFace's embedding API
  //   // You would need to set up a HuggingFace API key and choose a model
  //   throw new Error('HuggingFace embeddings not implemented yet');
  // }

  // Utility functions for embedding operations
  async findSimilarTexts(query: string, texts: string[], options?: EmbeddingOptions): Promise<{text: string; similarity: number}[]> {
    const queryEmbedding = await this.generateEmbedding(query, options);
    const embeddings = await Promise.all(
      texts.map(text => this.generateEmbedding(text, options))
    );

    return texts.map((text, i) => ({
      text,
      similarity: this.cosineSimilarity(queryEmbedding, embeddings[i])
    })).sort((a, b) => b.similarity - a.similarity);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }
}

export const embeddingService = EmbeddingService.getInstance();
