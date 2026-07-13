import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { films } from "@/db/schema";
import { sameIdSet } from "@/lib/library";
import { reorderSchema } from "@/lib/validation";

export async function PATCH(request: Request) {
  const parsed = reorderSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid watchlist order." },
      { status: 400 },
    );
  const unique = new Set(parsed.data.filmIds);
  if (unique.size !== parsed.data.filmIds.length)
    return NextResponse.json(
      { error: "Watchlist order contains duplicates." },
      { status: 400 },
    );
  try {
    const updated = db.transaction((tx) => {
      const currentIds = tx
        .select({ id: films.id })
        .from(films)
        .where(eq(films.status, "to_watch"))
        .all()
        .map(({ id }) => id);
      if (!sameIdSet(parsed.data.filmIds, currentIds))
        throw new Error("invalid-order");
      const count = parsed.data.filmIds.reduce((total, id, index) => {
        const result = tx
          .update(films)
          .set({ watchOrder: index + 1, updatedAt: new Date().toISOString() })
          .where(and(eq(films.id, id), eq(films.status, "to_watch")))
          .run();
        return total + result.changes;
      }, 0);
      if (count !== parsed.data.filmIds.length)
        throw new Error("invalid-order");
      return count;
    });
    return NextResponse.json({ updated });
  } catch {
    return NextResponse.json(
      { error: "One or more films are not in To Watch." },
      { status: 409 },
    );
  }
}
