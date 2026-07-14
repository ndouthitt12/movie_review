import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { scaleLevels } from "@/db/schema";
import { requireAdminApi } from "@/lib/admin-auth";

const scaleSchema = z.object({
  levels: z.array(z.object({
    level: z.number().int().min(0).max(10),
    title: z.string().trim().max(200),
    meaning: z.string().trim().max(1000),
    exampleFilms: z.string().trim().max(2000),
  })).length(11).refine((rows) => new Set(rows.map(({ level }) => level)).size === 11, "Scale must contain levels 0 through 10 exactly once."),
});

export async function GET() {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  return NextResponse.json({ levels: db.select().from(scaleLevels).orderBy(asc(scaleLevels.level)).all() });
}

export async function PUT(request: Request) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  const parsed = scaleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid scale." }, { status: 400 });
  db.transaction((tx) => {
    for (const level of parsed.data.levels)
      tx.insert(scaleLevels).values(level).onConflictDoUpdate({ target: scaleLevels.level, set: { title: level.title, meaning: level.meaning, exampleFilms: level.exampleFilms } }).run();
  });
  return NextResponse.json({ levels: parsed.data.levels });
}
