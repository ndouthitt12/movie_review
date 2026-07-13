import { and, eq, isNull, max, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { films, franchises } from "@/db/schema";
import { filmCreateSchema } from "@/lib/validation";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

class DuplicateFilmError extends Error {
  constructor(public readonly filmId: number) {
    super("That title and year are already in your library.");
  }
}

function findOrCreateFranchise(
  tx: Transaction,
  name: string,
  parentId: number | null,
) {
  const condition =
    parentId === null
      ? and(eq(franchises.name, name), isNull(franchises.parentId))
      : and(eq(franchises.name, name), eq(franchises.parentId, parentId));
  const existing = tx
    .select({ id: franchises.id })
    .from(franchises)
    .where(condition)
    .get();
  return (
    existing?.id ??
    tx
      .insert(franchises)
      .values({ name, parentId })
      .returning({ id: franchises.id })
      .get().id
  );
}

export async function POST(request: Request) {
  const parsed = filmCreateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid film data.", issues: parsed.error.issues },
      { status: 400 },
    );
  const input = parsed.data;

  try {
    const created = db.transaction((tx) => {
      if (input.tmdbId) {
        const tmdbDuplicate = tx
          .select({ id: films.id })
          .from(films)
          .where(eq(films.tmdbId, input.tmdbId))
          .get();
        if (tmdbDuplicate) throw new DuplicateFilmError(tmdbDuplicate.id);
      }
      const titleDuplicate = tx
        .select({ id: films.id })
        .from(films)
        .where(
          and(
            sql`lower(${films.title}) = ${input.title.toLowerCase()}`,
            eq(films.releaseYear, input.releaseYear),
          ),
        )
        .get();
      if (titleDuplicate) throw new DuplicateFilmError(titleDuplicate.id);

      const franchiseId = input.franchiseName
        ? findOrCreateFranchise(tx, input.franchiseName, null)
        : null;
      const subFranchiseId =
        input.subFranchiseName && franchiseId
          ? findOrCreateFranchise(tx, input.subFranchiseName, franchiseId)
          : null;
      const nextOrder =
        input.status === "to_watch" && input.watchOrder == null
          ? (tx
              .select({ value: max(films.watchOrder) })
              .from(films)
              .get()?.value ?? 0) + 1
          : input.watchOrder;
      return tx
        .insert(films)
        .values({
          tmdbId: input.tmdbId,
          title: input.title,
          releaseYear: input.releaseYear,
          status: input.status,
          watchOrder: nextOrder,
          genrePrimary: input.genrePrimary || null,
          genreSecondary: input.genreSecondary || null,
          franchiseId,
          subFranchiseId,
          notes: input.notes ?? "",
          posterPath: input.posterPath,
          backdropPath: input.backdropPath,
          runtime: input.runtime,
          director: input.director,
          overview: input.overview,
          tmdbGenres: input.tmdbGenres ?? [],
        })
        .returning({ id: films.id })
        .get();
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof DuplicateFilmError)
      return NextResponse.json(
        { error: error.message, id: error.filmId },
        { status: 409 },
      );
    return NextResponse.json({ error: "Could not add film." }, { status: 500 });
  }
}
