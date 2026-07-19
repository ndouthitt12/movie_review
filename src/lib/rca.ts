import { asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { filmRcaTags, rcaTags } from "@/db/schema";

export async function getRcaTagsWithUsage() {
  return db
    .select({
      id: rcaTags.id,
      label: rcaTags.label,
      questionKey: rcaTags.questionKey,
      polarity: rcaTags.polarity,
      color: rcaTags.color,
      usageCount: count(filmRcaTags.filmId),
    })
    .from(rcaTags)
    .leftJoin(filmRcaTags, eq(filmRcaTags.rcaTagId, rcaTags.id))
    .groupBy(rcaTags.id)
    .orderBy(
      asc(rcaTags.questionKey),
      asc(rcaTags.sortOrder),
      asc(rcaTags.label),
    );
}

export type RcaTagWithUsage = Awaited<
  ReturnType<typeof getRcaTagsWithUsage>
>[number];

export function isUniqueConstraint(error: unknown) {
  return (
    error instanceof Error &&
    (error.message.includes("UNIQUE constraint failed") ||
      error.message.includes("SQLITE_CONSTRAINT_UNIQUE") ||
      error.message.includes("duplicate key value violates unique constraint"))
  );
}
