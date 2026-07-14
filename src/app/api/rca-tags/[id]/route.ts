import { and, count, eq, ne, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { filmRcaTags, rcaTags } from "@/db/schema";
import { isUniqueConstraint } from "@/lib/rca";
import { rcaTagUpdateSchema } from "@/lib/validation";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number((await params).id);
  const parsed = rcaTagUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!Number.isInteger(id) || !parsed.success)
    return NextResponse.json({ error: "Invalid tag update." }, { status: 400 });
  const [existing] = await db.select().from(rcaTags).where(eq(rcaTags.id, id)).limit(1);
  if (!existing)
    return NextResponse.json({ error: "Tag not found." }, { status: 404 });
  if (parsed.data.label) {
    const [duplicate] = await db
      .select({ id: rcaTags.id })
      .from(rcaTags)
      .where(
        and(
          eq(rcaTags.questionKey, existing.questionKey),
          ne(rcaTags.id, id),
          sql`lower(${rcaTags.label}) = lower(${parsed.data.label})`,
        ),
      )
      .limit(1);
    if (duplicate)
      return NextResponse.json(
        { error: "That label already exists for this attribute." },
        { status: 409 },
      );
  }
  try {
    const [tag] = await db
      .update(rcaTags)
      .set(parsed.data)
      .where(eq(rcaTags.id, id))
      .returning();
    return NextResponse.json(tag);
  } catch (error) {
    if (isUniqueConstraint(error))
      return NextResponse.json(
        { error: "That label already exists for this attribute." },
        { status: 409 },
      );
    throw error;
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number((await params).id);
  if (!Number.isInteger(id))
    return NextResponse.json({ error: "Invalid tag id." }, { status: 400 });
  const [tag] = await db.select().from(rcaTags).where(eq(rcaTags.id, id)).limit(1);
  if (!tag)
    return NextResponse.json({ error: "Tag not found." }, { status: 404 });
  const [usageRow] = await db
    .select({ count: count() })
    .from(filmRcaTags)
    .where(eq(filmRcaTags.rcaTagId, id));
  await db.delete(rcaTags).where(eq(rcaTags.id, id));
  return NextResponse.json({ deleted: true, usageCount: usageRow?.count ?? 0 });
}
