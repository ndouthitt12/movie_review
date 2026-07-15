import { and, eq, max } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { films, watchLog } from "@/db/schema";
import { watchSchema } from "@/lib/validation";
import { invalidateRecommendations } from "@/lib/recs-cache";

type Context = { params: Promise<{ id: string; watchId: string }> };

async function updateLastWatch(
  filmId: number,
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
) {
  const [latest] = await tx
    .select({ date: max(watchLog.watchedOn).as("date") })
    .from(watchLog)
    .where(eq(watchLog.filmId, filmId));
  await tx.update(films)
    .set({ lastWatchDate: latest?.date ?? null, updatedAt: new Date().toISOString() })
    .where(eq(films.id, filmId));
}

export async function PATCH(request: Request, { params }: Context) {
  const values = await params;
  const filmId = Number(values.id);
  const watchId = Number(values.watchId);
  const parsed = watchSchema.safeParse(await request.json().catch(() => null));
  if (
    !Number.isInteger(filmId) ||
    !Number.isInteger(watchId) ||
    !parsed.success
  )
    return NextResponse.json(
      { error: "Invalid watch entry." },
      { status: 400 },
    );
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(watchLog)
      .set(parsed.data)
      .where(and(eq(watchLog.id, watchId), eq(watchLog.filmId, filmId)))
      .returning();
    if (row) await updateLastWatch(filmId, tx);
    return row;
  });
  if (updated) invalidateRecommendations();
  return updated
    ? NextResponse.json(updated)
    : NextResponse.json({ error: "Watch entry not found." }, { status: 404 });
}

export async function DELETE(_request: Request, { params }: Context) {
  const values = await params;
  const filmId = Number(values.id);
  const watchId = Number(values.watchId);
  if (!Number.isInteger(filmId) || !Number.isInteger(watchId))
    return NextResponse.json(
      { error: "Invalid watch entry." },
      { status: 400 },
    );
  const deleted = await db.transaction(async (tx) => {
    const [row] = await tx
      .delete(watchLog)
      .where(and(eq(watchLog.id, watchId), eq(watchLog.filmId, filmId)))
      .returning({ id: watchLog.id });
    if (row) await updateLastWatch(filmId, tx);
    return row;
  });
  if (deleted) invalidateRecommendations();
  return deleted
    ? NextResponse.json(deleted)
    : NextResponse.json({ error: "Watch entry not found." }, { status: 404 });
}
