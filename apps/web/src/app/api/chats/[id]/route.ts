
// app/api/chats/[id]/route.ts
import { db } from '@/db';
import { chats } from '@/db/schema';
import { auth } from '@/auth';
import { eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Delete chat only if it belongs to the user
    await db.delete(chats)
      .where(
        and(
          eq(chats.id, params.id),
          eq(chats.userId, session.user.id)
        )
      );

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting chat:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
