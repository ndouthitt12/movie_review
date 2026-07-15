import "./env";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { postgresClient } from "../src/db";

const sourceArg = process.argv
  .slice(2)
  .find((argument) => !argument.startsWith("--"));
const sourcePath = path.resolve(sourceArg ?? "data/movie-ratings.sqlite");

if (!fs.existsSync(sourcePath)) {
  throw new Error(`SQLite database not found: ${sourcePath}`);
}
if (!process.env.DATABASE_URL) {
  throw new Error(
    "Set DATABASE_URL to the destination PostgreSQL database before copying data.",
  );
}
if (!postgresClient) {
  throw new Error("A PostgreSQL connection is required for this command.");
}

const tables = [
  "franchises",
  "films",
  "form_versions",
  "form_sections",
  "questions",
  "question_options",
  "question_conditions",
  "answers",
  "ratings",
  "watch_log",
  "rca_tags",
  "film_rca_tags",
  "scale_levels",
  "settings",
] as const;

const booleanColumns = new Set([
  "questions.required",
  "questions.scored",
  "questions.secondary_scored",
  "questions.allow_na",
  "questions.rca_enabled",
  "question_options.is_null",
  "answers.is_na",
  "watch_log.is_rewatch",
]);
const jsonColumns = new Set([
  "films.tmdb_genres",
  "question_conditions.value",
  "answers.value_option_ids",
  "settings.weights",
  "settings.rubric",
]);
const sequenceTables = tables.filter(
  (table) => !["film_rca_tags", "scale_levels", "settings"].includes(table),
);

const sqlite = new Database(sourcePath, { readonly: true });

try {
  await postgresClient.begin(async (transaction) => {
    for (const table of tables) {
      const [{ count }] = await transaction.unsafe<{ count: number }[]>(
        `select count(*)::int as count from "${table}"`,
      );
      if (count > 0) {
        throw new Error(
          `Destination table ${table} is not empty. Use a new database to avoid duplicate data.`,
        );
      }
    }

    for (const table of tables) {
      const columns = sqlite
        .prepare(`pragma table_info("${table}")`)
        .all()
        .map((column) => (column as { name: string }).name);
      const rows = sqlite.prepare(`select * from "${table}"`).all() as Array<
        Record<string, unknown>
      >;

      for (const row of rows) {
        const values = columns.map((column) =>
          transformValue(table, column, row[column]),
        );
        const quotedColumns = columns.map((column) => `"${column}"`).join(", ");
        const placeholders = columns
          .map((_, index) => `$${index + 1}`)
          .join(", ");
        await transaction.unsafe(
          `insert into "${table}" (${quotedColumns}) values (${placeholders})`,
          values,
        );
      }
      console.log(`${table}: copied ${rows.length}`);
    }

    for (const table of sequenceTables) {
      await transaction.unsafe(
        `select setval(pg_get_serial_sequence('${table}', 'id'), coalesce(max(id), 1), max(id) is not null) from "${table}"`,
      );
    }
  });
  console.log("SQLite data copied to PostgreSQL successfully.");
} finally {
  sqlite.close();
  await postgresClient.end();
}

function transformValue(
  table: string,
  column: string,
  value: unknown,
): string | number | boolean | null {
  if (value === null) return null;
  const key = `${table}.${column}`;
  if (booleanColumns.has(key)) return value === 1;
  if (jsonColumns.has(key) && typeof value === "string") {
    JSON.parse(value);
    return value;
  }
  if (typeof value === "string" || typeof value === "number") return value;
  throw new Error(`Unsupported SQLite value in ${key}.`);
}
