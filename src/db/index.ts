import { drizzle as postgresDrizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://localhost/movie_ratings";
const postgresClient = postgres(connectionString, {
  max: 1,
  prepare: false,
  connect_timeout: 10,
  idle_timeout: 20,
});
const createPostgresDatabase = () =>
  postgresDrizzle({ client: postgresClient, schema });
export type Database = ReturnType<typeof createPostgresDatabase>;

export const db = createPostgresDatabase();

export { postgresClient };
