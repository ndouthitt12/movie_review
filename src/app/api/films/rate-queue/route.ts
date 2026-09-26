import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { films, ratings } from "@/db/schema";
import { rateQueue } from "@/lib/rate-queue";

/** Films to offer in "Rate a film" before anything is typed. */
export async function GET() {
  const rows = await db
    .select({
      id: films.id,
      title: films.title,
      releaseYear: films.releaseYear,
      posterPath: films.posterPath,
      status: films.status,
      watchOrder: films.watchOrder,
      lastWatchDate: films.lastWatchDate,
      overall: ratings.overall,
    })
    .from(films)
    .leftJoin(ratings, eq(ratings.filmId, films.id));
  return NextResponse.json(rateQueue(rows));
}
