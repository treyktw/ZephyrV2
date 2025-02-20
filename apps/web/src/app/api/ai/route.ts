// app/api/chat/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { messages as messagesTable } from '@/db/schema';
import { nanoid } from 'nanoid';
import { revalidatePath } from 'next/cache';
import geminiService from '@/lib/utils/gemini';
import { asc, eq } from 'drizzle-orm';

export async function PUT(req: Request) {
  const encoder = new TextEncoder();
  const session = await auth();

  if (!session?.user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { chatId, message } = await req.json();

    // Save user message first
    const userMessageId = nanoid();
    await db.insert(messagesTable).values({
      id: userMessageId,
      chatId,
      content: message,
      type: 'text',
      isUser: true,
      createdAt: new Date()
    });

    // Create transform stream for streaming
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Create AI message in DB
    const aiMessageId = nanoid();
    let accumulatedContent = '';

    // Start streaming response
    geminiService.streamResponse(chatId, message, async (token) => {
      accumulatedContent += token;

      // Update AI message in DB with accumulated content
      await db.update(messagesTable)
        .set({ content: accumulatedContent })
        .where(eq(messagesTable.id, aiMessageId));

      await writer.write(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`));
    }).then(async () => {
      // Save final AI message if not already saved
      await db.insert(messagesTable).values({
        id: aiMessageId,
        chatId,
        content: accumulatedContent,
        type: 'text',
        isUser: false,
        createdAt: new Date()
      }).onConflictDoUpdate({
        target: messagesTable.id,
        set: { content: accumulatedContent }
      });

      await writer.close();
      revalidatePath(`/chat/${chatId}`);
    }).catch(async (error) => {
      console.error('Streaming error:', error);
      await writer.abort(error);
    });

    return new NextResponse(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Streaming API error:', error);
    return new NextResponse(
      'Internal server error',
      { status: 500 }
    );
  }
}

// For fetching chat messages
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get('chatId');

    if (!chatId) {
      return new NextResponse('Missing chatId', { status: 400 });
    }

    const messages = await db.query.messages.findMany({
      where: eq(messagesTable.chatId, chatId),
      orderBy: [asc(messagesTable.createdAt)]
    });

    return NextResponse.json(messages);

  } catch (error) {
    console.error('Error fetching messages:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
