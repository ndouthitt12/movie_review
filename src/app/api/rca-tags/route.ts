import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { rcaTags } from "@/db/schema";
import { getRcaTagsWithUsage, isUniqueConstraint } from "@/lib/rca";
import { ensureDraftForm } from "@/lib/admin-form";
import { rcaTagCreateSchema } from "@/lib/validation";

export async function GET() {
  return NextResponse.json({ tags: await getRcaTagsWithUsage() });
}

export async function POST(request: Request) {
  const parsed = rcaTagCreateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid tag." },
      { status: 400 },
    );
  const allowedKeys = new Set([
    "overall",
    ...(await ensureDraftForm()).questions.map(({ key }) => key),
  ]);
  if (!allowedKeys.has(parsed.data.questionKey))
    return NextResponse.json(
      { error: "Question key is not part of the draft form." },
      { status: 400 },
    );
  const [duplicate] = await db
    .select({ id: rcaTags.id })
    .from(rcaTags)
    .where(
      and(
        eq(rcaTags.questionKey, parsed.data.questionKey),
        sql`lower(${rcaTags.label}) = lower(${parsed.data.label})`,
      ),
    )
    .limit(1);
  if (duplicate)
    return NextResponse.json(
      { error: "That label already exists for this attribute." },
      { status: 409 },
    );
  try {
    const [tag] = await db.insert(rcaTags).values(parsed.data).returning();
    if (!tag) throw new Error("Could not create RCA tag.");
    return NextResponse.json({ ...tag, usageCount: 0 }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraint(error))
      return NextResponse.json(
        { error: "That label already exists for this attribute." },
        { status: 409 },
      );
    throw error;
  }
}
