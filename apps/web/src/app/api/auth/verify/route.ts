// app/api/auth/verify/route.ts
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { token } = await request.json();
    console.log(token)
    const session = await auth();

    if (!session?.user?.email) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Update user verification status
    await db
      .update(users)
      .set({
        emailVerified: new Date(),
        // updatedAt: new Date()
      })
      .where(eq(users.email, session.user.email));

    return new NextResponse("Email verified", { status: 200 });
  } catch (error) {
    console.error("Verification error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
