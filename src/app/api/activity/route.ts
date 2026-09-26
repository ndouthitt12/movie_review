import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { films, ratings, watchLog } from "@/db/schema";
import { formatScore } from "@/lib/score-format";
import { getScoreScale } from "@/lib/score-scale";

export async function GET() {
  const [watches, recentRatings, scale] = await Promise.all([
    db
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
      .limit(4),
    db
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
      .limit(4),
    getScoreScale(),
  ]);

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
      detail: `Rated ${formatScore(rating.overall, scale)} ${scale === 5 ? "stars" : "out of 10"}`,
    })),
  ]
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 6);

  return NextResponse.json({ activity });
}
