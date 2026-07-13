import "dotenv/config";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createDb } from "../src/db";

const { db, sqlite } = createDb();
try {
  migrate(db, { migrationsFolder: "drizzle" });
  console.log("Database migrations applied successfully.");
} finally {
  sqlite.close();
}
