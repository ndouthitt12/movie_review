import { asc, ilike } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { films } from "@/db/schema";
import { searchTmdb } from "@/lib/tmdb-server";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2)
    return NextResponse.json({ library: [], tmdb: [] });

  const library = await db
    .select({
      id: films.id,
      tmdbId: films.tmdbId,
      title: films.title,
      releaseYear: films.releaseYear,
      posterPath: films.posterPath,
    })
    .from(films)
    .where(ilike(films.title, `%${query}%`))
    .orderBy(asc(films.title))
    .limit(6);
  const tmdb = await searchTmdb(query).catch(() => []);
  const libraryTmdbIds = new Set(
    library
      .map(({ tmdbId }) => tmdbId)
      .filter((id): id is number => id !== null),
  );

  return NextResponse.json({
    library,
    tmdb: tmdb
      .filter(({ id }) => !libraryTmdbIds.has(id))
      .slice(0, 6),
  });
}
