import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { rubricSchema } from "@/lib/validation";

export async function PUT(request: Request) {
  const parsed = rubricSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid rubric." },
      { status: 400 },
    );
  const updated = db
    .update(settings)
    .set({ rubric: parsed.data.rubric, updatedAt: new Date().toISOString() })
    .where(eq(settings.id, 1))
    .returning({ id: settings.id })
    .get();
  return updated
    ? NextResponse.json({ rubric: parsed.data.rubric })
    : NextResponse.json({ error: "Settings row not found." }, { status: 404 });
}
