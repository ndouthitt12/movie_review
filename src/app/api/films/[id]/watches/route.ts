import { eq, max } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { films, watchLog } from "@/db/schema";
import { watchSchema } from "@/lib/validation";
import { invalidateRecommendations } from "@/lib/recs-cache";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const filmId = Number((await params).id);
  const parsed = watchSchema.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(filmId) || !parsed.success)
    return NextResponse.json(
      { error: "Invalid watch entry." },
      { status: 400 },
    );
  const [exists] = await db
    .select({ id: films.id })
    .from(films)
    .where(eq(films.id, filmId))
    .limit(1);
  if (!exists)
    return NextResponse.json({ error: "Film not found." }, { status: 404 });
  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(watchLog)
      .values({ filmId, ...parsed.data })
      .returning();
    const [latest] = await tx
      .select({ date: max(watchLog.watchedOn).as("date") })
      .from(watchLog)
      .where(eq(watchLog.filmId, filmId));
    await tx.update(films)
      .set({
        lastWatchDate: latest?.date ?? null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(films.id, filmId));
    return row;
  });
  invalidateRecommendations();
  return NextResponse.json(created, { status: 201 });
}
