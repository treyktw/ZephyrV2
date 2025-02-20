// drizzle.config.ts
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/lib/db/schema.ts",
  driver: 'durable-sqlite',
  out: "./drizzle",
  dialect: "sqlite"
} satisfies Config;
