import fs from "node:fs/promises";
import path from "node:path";
import { testClient } from "@/test/db";

function requireTestClient() {
  if (!testClient) {
    throw new Error("The in-memory database is only available during tests.");
  }
  return testClient;
}

export async function resetTestDatabase() {
  const client = requireTestClient();
  await client.exec(
    "drop schema if exists public cascade; create schema public;",
  );

  const migrationsRoot = path.resolve("drizzle-postgres");
  const directories = (
    await fs.readdir(migrationsRoot, { withFileTypes: true })
  )
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const directory of directories) {
    const migration = await fs.readFile(
      path.join(migrationsRoot, directory, "migration.sql"),
      "utf8",
    );
    for (const statement of migration.split("--> statement-breakpoint")) {
      if (statement.trim()) await client.exec(statement);
    }
  }
}

export async function queryRows<T extends Record<string, unknown>>(
  sql: string,
  parameters: unknown[] = [],
) {
  const result = await requireTestClient().query<T>(sql, parameters);
  return result.rows;
}

export async function queryRow<T extends Record<string, unknown>>(
  sql: string,
  parameters: unknown[] = [],
) {
  return (await queryRows<T>(sql, parameters))[0];
}
