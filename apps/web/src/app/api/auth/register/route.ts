// app/api/register/route.ts
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, name } = await request.json();

    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    if (existingUser) {
      return new NextResponse(
        JSON.stringify({ error: 'User already exists' }),
        { status: 409 }
      );
    }

    // Create new user
    const [user] = await db.insert(users)
      .values({
        email: email.toLowerCase(),
        name,
      })
      .returning();

    return NextResponse.json(user);
  } catch (error) {
    console.error('Registration error:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Failed to create user' }),
      { status: 500 }
    );
  }
}
