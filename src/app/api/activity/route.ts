import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { films, ratings, watchLog } from "@/db/schema";

export async function GET() {
  const watches = await db
    .select({
      id: watchLog.id,
      filmId: films.id,
      title: films.title,
      date: watchLog.watchedOn,
      isRewatch: watchLog.isRewatch,
    })
    .from(watchLog)
    .innerJoin(films, eq(films.id, watchLog.filmId))
    .orderBy(desc(watchLog.watchedOn), desc(watchLog.id))
    .limit(4);
  const recentRatings = await db
    .select({
      id: ratings.id,
      filmId: films.id,
      title: films.title,
      date: ratings.ratedAt,
      overall: ratings.overall,
    })
    .from(ratings)
    .innerJoin(films, eq(films.id, ratings.filmId))
    .orderBy(desc(ratings.ratedAt), desc(ratings.id))
    .limit(4);

  const activity = [
    ...watches.map((watch) => ({
      key: `watch-${watch.id}`,
      filmId: watch.filmId,
      title: watch.title,
      date: watch.date,
      detail: watch.isRewatch ? "Rewatched" : "Watched",
    })),
    ...recentRatings.map((rating) => ({
      key: `rating-${rating.id}`,
      filmId: rating.filmId,
      title: rating.title,
      date: rating.date,
      detail: `Rated ${(rating.overall / 2).toFixed(1)} stars`,
    })),
  ]
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 6);

  return NextResponse.json({ activity });
}
