// lib/utils/chat.ts
import { db } from '@/db';
import { messages, chats } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function getLatestMessage(chatId: string) {
  try {
    const [message] = await db
      .select()
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(desc(messages.createdAt))
      .limit(1);

    return message;
  } catch (error) {
    console.error('Error getting latest message:', error);
    return null;
  }
}

export async function updateChatTitle(chatId: string, title: string) {
  try {
    await db
      .update(chats)
      .set({ title })
      .where(eq(chats.id, chatId));

    return true;
  } catch (error) {
    console.error('Error updating chat title:', error);
    return false;
  }
}
