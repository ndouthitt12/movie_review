import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { rcaTags } from "@/db/schema";
import { rcaTagReorderSchema } from "@/lib/validation";

export async function PUT(request: Request) {
  const parsed = rcaTagReorderSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid tag order." },
      { status: 400 },
    );

  const tags = await db
    .select({ id: rcaTags.id, questionKey: rcaTags.questionKey })
    .from(rcaTags)
    .where(inArray(rcaTags.id, parsed.data.orderedIds));
  const questionKey = tags[0]?.questionKey;
  if (
    tags.length !== parsed.data.orderedIds.length ||
    !questionKey ||
    tags.some((tag) => tag.questionKey !== questionKey)
  )
    return NextResponse.json(
      { error: "Tags must belong to the same question." },
      { status: 409 },
    );

  const allTags = await db
    .select({ id: rcaTags.id })
    .from(rcaTags)
    .where(eq(rcaTags.questionKey, questionKey));
  if (allTags.length !== tags.length)
    return NextResponse.json(
      { error: "The tag list changed. Refresh and try again." },
      { status: 409 },
    );

  await db.transaction(async (tx) => {
    for (const [index, id] of parsed.data.orderedIds.entries())
      await tx
        .update(rcaTags)
        .set({ sortOrder: index * 10 })
        .where(eq(rcaTags.id, id));
  });

  return NextResponse.json({ reordered: true });
}
