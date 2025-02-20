// lib/services/chat.ts
import { pinecone, redis } from "@/db";
import { db } from "@/db/dexie";
import { Message } from "@/types/chat.types";
import { nanoid } from "nanoid";
import { embeddingService } from "./embeddings";

export class ChatService {
  private static instance: ChatService;
  private constructor() {}

  static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  async processMessage(
    chatId: string,
    content: string,
    isUser: boolean,
  ): Promise<Message> {
    try {
      // Create message
      const message: Message = {
        id: nanoid(),
        chatId,
        content,
        type: "text",
        isUser,
        createdAt: new Date(),
      };

      // Store in Dexie for local persistence
      await db.messages.add(message);

      // Store in Redis for caching
      await redis.hset(`chat:${chatId}`, {
        [message.id]: JSON.stringify(message),
      });

      // If it's a user message, generate embedding and store in Pinecone
      if (isUser) {
        const vector = await this.generateEmbedding(content);
        const index = pinecone.Index("chats");

        await index.upsert([
          {
            id: message.id,
            values: vector,
            metadata: {
              chatId,
              messageId: message.id,
              content,
            },
          },
        ]);

        // Store embedding reference locally
        await db.embeddings.add({
          id: nanoid(),
          chatId,
          messageId: message.id,
          vector,
        });
      }

      return message;
    } catch (error) {
      console.error("Error processing message:", error);
      throw error;
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      return await embeddingService.generateEmbedding(text, {
        provider: "openai", // or whichever provider you prefer
        useCache: true,
        cacheDuration: 24 * 60 * 60, // 24 hours
      });
    } catch (error) {
      console.error("Error generating embedding:", error);
      // Fallback to local embedding if API fails
      return await embeddingService.generateEmbedding(text, {
        provider: "local",
        useCache: true,
      });
    }
  }

  async searchSimilarMessages(content: string): Promise<Message[]> {
    try {
      const vector = await this.generateEmbedding(content);
      const index = pinecone.Index("chats");

      const results = await index.query({
        vector,
        topK: 5,
        includeMetadata: true,
      });

      // Fetch full messages from Redis/Dexie
      const messages = await Promise.all(
        results.matches.map(async (match) => {
          const messageId = match.metadata?.messageId;
          if (!messageId || typeof messageId !== "string") return null;
          // Try Redis first
          const cached = await redis.hget(
            `chat:${match.metadata?.chatId}`,
            messageId,
          );
          if (typeof cached === "string") return JSON.parse(cached);

          // Fallback to Dexie
          return await db.messages.get(messageId);
        }),
      );

      return messages.filter(Boolean) as Message[];
    } catch (error) {
      console.error("Error searching similar messages:", error);
      return [];
    }
  }
}

export const chatService = ChatService.getInstance();
