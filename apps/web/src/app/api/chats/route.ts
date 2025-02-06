// app/api/chats/route.ts
import { db } from '@/db';
import { chats, messages } from '@/db/schema';
import { auth } from '@/auth';
import { eq, desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // First get all chats
    const userChats = await db.query.chats.findMany({
      where: eq(chats.userId, session.user.id),
      orderBy: [desc(chats.createdAt)],
    });

    // Then get last messages for each chat
    const chatsWithMessages = await Promise.all(
      userChats.map(async (chat) => {
        const lastMessage = await db.query.messages.findFirst({
          where: eq(messages.chatId, chat.id),
          orderBy: [desc(messages.createdAt)],
        });

        return {
          id: chat.id,
          title: chat.title || 'New Chat',
          lastMessage: lastMessage?.content,
          createdAt: chat.createdAt,
        };
      })
    );

    return NextResponse.json(chatsWithMessages);
  } catch (error) {
    console.error('Error fetching chats:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const chatId = nanoid();

    // Create a new chat
    const [chat] = await db.insert(chats)
      .values({
        id: chatId,
        userId: session.user.id,
        title: 'New Chat',
      })
      .returning();

    return NextResponse.json(chat);
  } catch (error) {
    console.error('Error creating chat:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
