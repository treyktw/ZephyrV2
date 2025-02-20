// src/lib/db/migrate.ts
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '.';

console.log('Running migrations...');

migrate(db, { migrationsFolder: './drizzle' });

console.log('Migrations complete!');
