import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle-postgres",
  dbCredentials: {
    url:
      process.env.DATABASE_MIGRATION_URL ||
      process.env.DATABASE_URL ||
      "postgresql://localhost/movie_ratings",
  },
});
