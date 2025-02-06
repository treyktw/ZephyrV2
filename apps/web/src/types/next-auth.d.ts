import { DefaultSession, DefaultUser } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      emailVerified?: Date | null
    } & DefaultSession["user"]
  }

  interface User extends DefaultUser {
    id: string
    emailVerified?: Date | null
  }
}

// If you're using JWT, you might also want to extend the JWT type
declare module "next-auth/jwt" {
  interface JWT {
    id: string
    emailVerified?: Date | null
  }
}
