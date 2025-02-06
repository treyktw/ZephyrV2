import { eq } from 'drizzle-orm';
import db from './index';
import { users, } from './schema';
import type { NewUser, User } from '@/types/db.types';

export async function getUserById(id: string) {
  const result = await db.select().from(users).where(eq(users.id, id));
  return result[0] || null;
}

export async function getUserByEmail(email: string) {
  const result = await db.select().from(users).where(eq(users.email, email));
  return result[0] || null;
}

export async function createUser(userData: NewUser) {
  const result = await db.insert(users).values(userData).returning();
  return result[0];
}

export async function updateUser(id: string, userData: Partial<User>) {
  const result = await db
    .update(users)
    .set({ ...userData, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return result[0];
}

export async function deleteUser(id: string) {
  await db.delete(users).where(eq(users.id, id));
}
