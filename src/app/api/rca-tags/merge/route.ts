import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { filmRcaTags, rcaTags } from "@/db/schema";
import { rcaTagMergeSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const parsed = rcaTagMergeSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success || parsed.data.sourceId === parsed.data.targetId)
    return NextResponse.json(
      { error: "Choose two different tags." },
      { status: 400 },
    );
  const source = db
    .select()
    .from(rcaTags)
    .where(eq(rcaTags.id, parsed.data.sourceId))
    .get();
  const target = db
    .select()
    .from(rcaTags)
    .where(eq(rcaTags.id, parsed.data.targetId))
    .get();
  if (!source || !target)
    return NextResponse.json({ error: "Tag not found." }, { status: 404 });
  if (source.attribute !== target.attribute)
    return NextResponse.json(
      { error: "Only tags for the same attribute can be merged." },
      { status: 409 },
    );

  db.transaction((tx) => {
    const uses = tx
      .select({ filmId: filmRcaTags.filmId })
      .from(filmRcaTags)
      .where(eq(filmRcaTags.rcaTagId, source.id))
      .all();
    for (const { filmId } of uses) {
      const exists = tx
        .select({ filmId: filmRcaTags.filmId })
        .from(filmRcaTags)
        .where(
          and(
            eq(filmRcaTags.filmId, filmId),
            eq(filmRcaTags.rcaTagId, target.id),
          ),
        )
        .get();
      if (!exists)
        tx.insert(filmRcaTags).values({ filmId, rcaTagId: target.id }).run();
    }
    tx.delete(rcaTags).where(eq(rcaTags.id, source.id)).run();
  });
  return NextResponse.json({ merged: true, targetId: target.id });
}
