import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle-postgres",
  dbCredentials: {
    url:
      process.env.DATABASE_MIGRATION_URL ??
      process.env.DATABASE_URL ??
      "postgresql://localhost/movie_ratings",
  },
});
