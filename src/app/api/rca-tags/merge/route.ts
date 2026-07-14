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
  const [source] = await db
    .select()
    .from(rcaTags)
    .where(eq(rcaTags.id, parsed.data.sourceId))
    .limit(1);
  const [target] = await db
    .select()
    .from(rcaTags)
    .where(eq(rcaTags.id, parsed.data.targetId))
    .limit(1);
  if (!source || !target)
    return NextResponse.json({ error: "Tag not found." }, { status: 404 });
  if (source.questionKey !== target.questionKey)
    return NextResponse.json(
      { error: "Only tags for the same attribute can be merged." },
      { status: 409 },
    );

  await db.transaction(async (tx) => {
    const uses = await tx
      .select({ filmId: filmRcaTags.filmId })
      .from(filmRcaTags)
      .where(eq(filmRcaTags.rcaTagId, source.id));
    for (const { filmId } of uses) {
      const [exists] = await tx
        .select({ filmId: filmRcaTags.filmId })
        .from(filmRcaTags)
        .where(
          and(
            eq(filmRcaTags.filmId, filmId),
            eq(filmRcaTags.rcaTagId, target.id),
          ),
        )
        .limit(1);
      if (!exists)
        await tx.insert(filmRcaTags).values({ filmId, rcaTagId: target.id });
    }
    await tx.delete(rcaTags).where(eq(rcaTags.id, source.id));
  });
  return NextResponse.json({ merged: true, targetId: target.id });
}
