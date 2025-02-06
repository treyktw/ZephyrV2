// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";

// Array of public routes that don't require authentication
const publicRoutes = [
  "/",
  "/login",
  "/register",
  "/verify",
  "/auth/callback/verify",
];

// Routes that require email verification
const verificationRequiredRoutes = ["/dashboard"];

export async function middleware(request: NextRequest) {
  const session = await auth();

  // Get the pathname of the request (e.g. /, /protected)
  const path = request.nextUrl.pathname;

  // Check if the path is public
  const isPublicRoute = publicRoutes.some((route) =>
    path.startsWith(route)
  );

  // If the path is public, allow access
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Check if user is authenticated
  if (!session?.user) {
    const url = new URL('/login', request.url);
    url.searchParams.set('callbackUrl', path);
    return NextResponse.redirect(url);
  }

  // Check if email verification is required for this route
  if (
    verificationRequiredRoutes.some((route) => path.startsWith(route)) &&
    !session.user.emailVerified &&
    session.user.email
  ) {
    const verifyUrl = new URL('/auth/verify', request.url);
    return NextResponse.redirect(verifyUrl);
  }

  return NextResponse.next();
}

// Specify which routes this middleware should run for
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
