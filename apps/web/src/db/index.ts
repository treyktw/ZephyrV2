// lib/db/index.ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

import * as schema from './schema';

// Optional: configure neon to use SSL
const sql = neon(process.env.DATABASE_URL || "postgresql://neondb_owner:npg_FGh68VxabZRM@ep-super-term-a4orbpbl-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require");
export const db = drizzle(sql, {schema});




// Add type exports
export type Database = typeof db;

export * from './dexie';
export * from './redis';
export * from './pinecone';
