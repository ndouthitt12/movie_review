import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { defaultWeights } from "@/db/seed-data";
import { films, ratings, settings, watchLog } from "@/db/schema";
import {
  computeOverall,
  computeSecondary,
  type RatingWeights,
} from "@/lib/scoring";
import { ratingSchema } from "@/lib/validation";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number((await params).id);
  const parsed = ratingSchema.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success)
    return NextResponse.json(
      { error: "All scores must be integers from 0 to 100." },
      { status: 400 },
    );
  const film = db
    .select({ status: films.status })
    .from(films)
    .where(eq(films.id, id))
    .get();
  if (!film)
    return NextResponse.json({ error: "Film not found." }, { status: 404 });
  const setting = db
    .select({ weights: settings.weights })
    .from(settings)
    .where(eq(settings.id, 1))
    .get();
  const weights = (setting?.weights ?? defaultWeights) as RatingWeights;
  const { promoteToWatched, watchedOn, quality, ...scores } = parsed.data;
  const overall = computeOverall(scores, weights);
  const secondary = computeSecondary(
    quality,
    scores.rewatchability,
    scores.genreFit,
  );
  const now = new Date().toISOString();

  db.transaction((tx) => {
    tx.insert(ratings)
      .values({
        filmId: id,
        ...scores,
        quality,
        overall,
        overallSecondary: secondary,
        ratedAt: now,
      })
      .onConflictDoUpdate({
        target: ratings.filmId,
        set: {
          ...scores,
          quality,
          overall,
          overallSecondary: secondary,
          ratedAt: now,
        },
      })
      .run();
    if (film.status === "to_watch" && promoteToWatched) {
      const today = watchedOn!;
      tx.update(films)
        .set({ status: "watched", lastWatchDate: today, updatedAt: now })
        .where(eq(films.id, id))
        .run();
      tx.insert(watchLog)
        .values({ filmId: id, watchedOn: today, isRewatch: false })
        .run();
    }
  });
  return NextResponse.json({ overall, secondary });
}
