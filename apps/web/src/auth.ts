// auth.ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Github from "next-auth/providers/github";
import Resend from "next-auth/providers/resend";
import { accounts, sessions, users, verificationTokens } from "./db/schema";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { EmailTemplate } from "./emails";
import { resend } from "./lib/resend";
import { db } from "./db";
import { eq } from "drizzle-orm";


export const { handlers, signIn, signOut, auth } = NextAuth({
  callbacks: {
    async signIn({ user, account }) {
      // Allow sign in if email is verified or if it's a social login
      return !!user.emailVerified || account?.provider !== "resend";
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.emailVerified = user.emailVerified;
      }
      return session;
    },
  },
  events: {
    async linkAccount() {
      // When a social account is linked, mark email as verified
      await db
        .update(users)
        .set({
          emailVerified: new Date(),
          // updatedAt: new Date()
        })
        .where(eq(users.id, users.id));
    },
  },
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Github({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    Resend({
      apiKey: process.env.RESEND_API_KEY || "re_cJWMSDEB_DxDToUqWsfvZnc1VMwUi79yv",
      from: "Zephyr <no-reply@treyktw.dev>",
      async sendVerificationRequest({ identifier: email, url }) {
        try {

          const verifyUrl = url.replace(
            "/auth/verify-request",
            "/auth/callback/verify"
          );

          await resend.emails.send({
            from: "Zephyr <no-reply@treyktw.dev>",
            to: email,
            subject: "Sign in to ZephyrV2",
            react:  EmailTemplate({
              verificationLink: verifyUrl,
              userEmail: email
            })
          });
        } catch (error) {
          console.error("Failed to send verification email", error);
          throw new Error("Failed to send verification email");
        }
      },
    }),
  ],
  pages: {
    signIn: '/login',
    verifyRequest: '/verify',
    error: '/error'
  },
});
