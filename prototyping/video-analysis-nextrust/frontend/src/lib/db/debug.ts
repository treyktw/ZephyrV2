// src/lib/db/debug.ts
import { Database } from "bun:sqlite";

const db = new Database("sqlite.db");
const tables = db.query("SELECT name FROM sqlite_master WHERE type='table';").all();
console.log("Tables in database:", tables);

const videosSchema = db.query("PRAGMA table_info(videos);").all();
console.log("\nVideos table schema:", videosSchema);
