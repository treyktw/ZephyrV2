import Dexie, { Table } from 'dexie';
import { Message } from '@/types/chat.types';

export class ChatDatabase extends Dexie {
  messages!: Table<Message>;
  embeddings!: Table<{
    id: string;
    chatId: string;
    messageId: string;
    vector: number[];
  }>;

  constructor() {
    super('chatDB');
    this.version(1).stores({
      messages: '++id, chatId, createdAt',
      embeddings: '++id, chatId, messageId'
    });
  }
}

export const db = new ChatDatabase();
