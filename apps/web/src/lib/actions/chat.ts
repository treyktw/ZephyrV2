// lib/actions/chat.ts
'use server'

import { db } from '@/db';
import { chats, messages } from '@/db/schema';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { eq, and } from 'drizzle-orm';
import { Chat } from '@/types/chat.types';
// import { llmClient } from '../llm/client';

// Create a new chat
export async function createChat(initialMessage: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not authenticated');

  try {
    const chatId = crypto.randomUUID();

    // First, create the chat immediately
    await db.insert(chats)
      .values({
        id: chatId,
        userId: session.user.id,
        title: initialMessage.slice(0, 50) + (initialMessage.length > 50 ? '...' : ''),
      });

    // Then save the initial user message
    await db.insert(messages)
      .values({
        id: crypto.randomUUID(),
        chatId,
        content: initialMessage,
        type: 'text',
        isUser: true,
      });

    revalidatePath('/chat');
    return chatId;
  } catch (error) {
    console.error('Failed to create chat:', error);
    throw new Error('Failed to create chat');
  }
}

// Fetch a chat and its messages
export async function fetchChat(chatId: string): Promise<Chat | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  try {
    // Get the chat
    const chat = await db.query.chats.findFirst({
      where: and(
        eq(chats.id, chatId),
        eq(chats.userId, session.user.id)
      ),
    });

    if (!chat) return null;

    // Get all messages for this chat
    const chatMessages = await db.query.messages.findMany({
      where: eq(messages.chatId, chatId),
      orderBy: (messages, { asc }) => [asc(messages.createdAt)],
    });

    return {
      ...chat,
      title: chat.title || 'Untitled Chat',
      messages: chatMessages.map(msg => ({
        ...msg,
        type: msg.type || 'text',
        isUser: msg.isUser ?? false,
        createdAt: msg.createdAt || new Date(),
        metadata: msg.metadata || {},
      })),
      lastMessage: chatMessages[chatMessages.length - 1]?.content || '',
    };
  } catch (error) {
    console.error('Failed to fetch chat:', error);
    return null;
  }
}

// Save a new message
export async function saveMessage(
  chatId: string,
  content: string,
  type: string = 'text',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: { isAI?: boolean; isUser?: boolean; [key: string]: any } = {}
) {
  try {
    // Ensure isUser is explicitly set based on metadata
    const isUser = metadata.isUser ?? !metadata.isAI;

    // Log what we're saving for debugging
    console.log('Saving message:', {
      chatId,
      content: content.slice(0, 50),
      type,
      isUser,
      metadata
    });

    const [message] = await db.insert(messages)
      .values({
        id: crypto.randomUUID(),
        chatId,
        content,
        type,
        isUser,
        metadata
      })
      .returning();

    // Revalidate the chat page to show new messages
    revalidatePath(`/chat/${chatId}`);

    return message;
  } catch (error) {
    console.error('Failed to save message:', error);
    throw new Error('Failed to save message');
  }
}

// Update chat title
export async function updateChatTitle(chatId: string, title: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not authenticated');

  try {
    await db.update(chats)
      .set({ title, updatedAt: new Date() })
      .where(
        and(
          eq(chats.id, chatId),
          eq(chats.userId, session.user.id)
        )
      );

    revalidatePath(`/chat/${chatId}`);
  } catch (error) {
    console.error('Failed to update chat title:', error);
    throw new Error('Failed to update chat title');
  }
}

// Delete a chat
export async function deleteChat(chatId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not authenticated');

  try {
    // Messages will be cascade deleted due to foreign key constraint
    await db.delete(chats)
      .where(
        and(
          eq(chats.id, chatId),
          eq(chats.userId, session.user.id)
        )
      );

    revalidatePath('/chat');
  } catch (error) {
    console.error('Failed to delete chat:', error);
    throw new Error('Failed to delete chat');
  }
}
