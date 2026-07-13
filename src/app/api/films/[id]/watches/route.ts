import { eq, max } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { films, watchLog } from "@/db/schema";
import { watchSchema } from "@/lib/validation";

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
  const exists = db
    .select({ id: films.id })
    .from(films)
    .where(eq(films.id, filmId))
    .get();
  if (!exists)
    return NextResponse.json({ error: "Film not found." }, { status: 404 });
  const created = db.transaction((tx) => {
    const row = tx
      .insert(watchLog)
      .values({ filmId, ...parsed.data })
      .returning()
      .get();
    const latest = tx
      .select({ date: max(watchLog.watchedOn) })
      .from(watchLog)
      .where(eq(watchLog.filmId, filmId))
      .get()?.date;
    tx.update(films)
      .set({
        lastWatchDate: latest ?? null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(films.id, filmId))
      .run();
    return row;
  });
  return NextResponse.json(created, { status: 201 });
}
