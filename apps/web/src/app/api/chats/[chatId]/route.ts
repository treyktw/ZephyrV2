import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import geminiService from '@/lib/utils/gemini';

export async function POST(
  req: Request,
  { params }: { params: { chatId: string } }
) {
  const encoder = new TextEncoder();
  const session = await auth();

  if (!session?.user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    console.log('Starting chat request');
    const { message } = await req.json();
    const chatId = params.chatId;

    // Create transform stream for streaming
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Process the response in a separate async function
    const processStream = async () => {
      try {
        await geminiService.streamResponse(chatId, message, async (token) => {
          console.log('Writing token:', token);
          await writer.write(
            encoder.encode(`data: ${JSON.stringify({ token })}\n\n`)
          );
        });
        console.log('Stream completed');
        await writer.close();
      } catch (error) {
        console.error('Stream processing error:', error);
        await writer.abort(error);
      }
    };

    // Start processing without waiting
    processStream();

    return new NextResponse(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
