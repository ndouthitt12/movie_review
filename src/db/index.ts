import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

export function resolveDatabasePath() {
  return path.resolve(
    /* turbopackIgnore: true */ process.cwd(),
    process.env.DATABASE_URL ?? "data/movie-ratings.sqlite",
  );
}

export function createDb(databasePath = resolveDatabasePath()) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const sqlite = new Database(databasePath);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  return { db: drizzle(sqlite, { schema }), sqlite };
}

export const { db, sqlite } = createDb();
