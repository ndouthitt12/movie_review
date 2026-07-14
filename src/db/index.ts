import { PGlite } from "@electric-sql/pglite";
import { drizzle as netlifyDrizzle } from "drizzle-orm/netlify-db";
import { drizzle as pgliteDrizzle } from "drizzle-orm/pglite";
import * as schema from "./schema";

const createNetlifyDatabase = () => netlifyDrizzle({ schema });
export type Database = ReturnType<typeof createNetlifyDatabase>;

const testClient = process.env.NODE_ENV === "test" ? new PGlite() : null;

export const db = (testClient
  ? pgliteDrizzle({ client: testClient, schema })
  : createNetlifyDatabase()) as Database;

export { testClient };
