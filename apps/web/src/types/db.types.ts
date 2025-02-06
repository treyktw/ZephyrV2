// lib/db/types.ts
import { sessions, users, verificationTokens } from "@/db/schema";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Infer types from schema
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type Session = InferSelectModel<typeof sessions>;
export type NewSession = InferInsertModel<typeof sessions>;

export type VerificationToken = InferSelectModel<typeof verificationTokens>;
export type NewVerificationToken = InferInsertModel<typeof verificationTokens>;

// User preferences type
export interface UserPreferences {
  theme?: "light" | "dark";
  accentColor?: "blue" | "red" | "green" | "yellow" | "pink" | "purple";
  emailNotifications?: {
    marketing?: boolean;
    security?: boolean;
    updates?: boolean;
  };
  timezone?: string;
}

// Helper type for social providers
export type SocialProvider = "google" | "github" | "microsoft" | "email";

// Helper type for auth functions
export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  image?: string;
  provider?: SocialProvider;
  providerAccountId?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface Profile {
  id: string;
  email: string;
  name?: string;
  image?: string | null;
  accessToken: string;
  refreshToken: string;
}
