import { and, eq, isNull, max, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { films, franchises } from "@/db/schema";
import { filmCreateSchema } from "@/lib/validation";
import { invalidateRecommendations } from "@/lib/recs-cache";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

class DuplicateFilmError extends Error {
  constructor(public readonly filmId: number) {
    super("That title and year are already in your library.");
  }
}

async function findOrCreateFranchise(
  tx: Transaction,
  name: string,
  parentId: number | null,
) {
  const condition =
    parentId === null
      ? and(eq(franchises.name, name), isNull(franchises.parentId))
      : and(eq(franchises.name, name), eq(franchises.parentId, parentId));
  const [existing] = await tx
    .select({ id: franchises.id })
    .from(franchises)
    .where(condition)
    .limit(1);
  if (existing) return existing.id;
  const [created] = await tx
    .insert(franchises)
    .values({ name, parentId })
    .returning({ id: franchises.id });
  if (!created) throw new Error("Could not create franchise.");
  return created.id;
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
    const created = await db.transaction(async (tx) => {
      if (input.tmdbId) {
        const [tmdbDuplicate] = await tx
          .select({ id: films.id })
          .from(films)
          .where(eq(films.tmdbId, input.tmdbId))
          .limit(1);
        if (tmdbDuplicate) throw new DuplicateFilmError(tmdbDuplicate.id);
      }
      const [titleDuplicate] = await tx
        .select({ id: films.id })
        .from(films)
        .where(
          and(
            sql`lower(${films.title}) = ${input.title.toLowerCase()}`,
            eq(films.releaseYear, input.releaseYear),
          ),
        )
        .limit(1);
      if (titleDuplicate) throw new DuplicateFilmError(titleDuplicate.id);

      const franchiseId = input.franchiseName
        ? await findOrCreateFranchise(tx, input.franchiseName, null)
        : null;
      const subFranchiseId =
        input.subFranchiseName && franchiseId
          ? await findOrCreateFranchise(tx, input.subFranchiseName, franchiseId)
          : null;
      const nextOrder =
        input.status === "to_watch" && input.watchOrder == null
          ? ((await tx
              .select({ value: max(films.watchOrder) })
              .from(films))[0]?.value ?? 0) + 1
          : input.watchOrder;
      const [film] = await tx
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
        .returning({ id: films.id });
      if (!film) throw new Error("Could not create film.");
      return film;
    });
    invalidateRecommendations();
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
