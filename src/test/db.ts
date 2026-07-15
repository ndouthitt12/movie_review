import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";

export const testClient = new PGlite();
export const db = drizzle({ client: testClient, schema });
export const postgresClient = null;
