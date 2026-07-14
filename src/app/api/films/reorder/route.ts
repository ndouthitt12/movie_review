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
    const updated = await db.transaction(async (tx) => {
      const currentIds = (await tx
        .select({ id: films.id })
        .from(films)
        .where(eq(films.status, "to_watch")))
        .map(({ id }) => id);
      if (!sameIdSet(parsed.data.filmIds, currentIds))
        throw new Error("invalid-order");
      let count = 0;
      for (const [index, id] of parsed.data.filmIds.entries()) {
        const result = await tx
          .update(films)
          .set({ watchOrder: index + 1, updatedAt: new Date().toISOString() })
          .where(and(eq(films.id, id), eq(films.status, "to_watch")))
          .returning({ id: films.id });
        count += result.length;
      }
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
