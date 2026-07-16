import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { films } from "@/db/schema";
import { CATALOG_OPTIONS_CACHE_TAG } from "@/lib/cache-tags";
import { filmUpdateSchema } from "@/lib/validation";
import { invalidateRecommendations } from "@/lib/recs-cache";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number((await params).id);
  const parsed = filmUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!Number.isInteger(id) || !parsed.success)
    return NextResponse.json(
      { error: "Invalid film update." },
      { status: 400 },
    );
  const [updated] = await db
    .update(films)
    .set({ ...parsed.data, updatedAt: new Date().toISOString() })
    .where(eq(films.id, id))
    .returning({ id: films.id });
  if (updated) {
    invalidateRecommendations();
    revalidateTag(CATALOG_OPTIONS_CACHE_TAG, { expire: 0 });
  }
  return updated
    ? NextResponse.json(updated)
    : NextResponse.json({ error: "Film not found." }, { status: 404 });
}
