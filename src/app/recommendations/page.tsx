import { Suspense } from "react";
import { connection } from "next/server";
import { PageShell } from "@/components/page-shell";
import { RouteContentLoading } from "@/components/route-content-loading";
import { PosterGrid, type HomePoster } from "@/components/home/poster-rail";
import { getRecommendations } from "@/lib/recs-server";

export const unstable_instant = { prefetch: "static" };

export default function RecommendationsPage() {
  return (
    <PageShell>
      <Suspense
        fallback={<RouteContentLoading label="Loading recommendations" />}
      >
        <RecommendationsContent />
      </Suspense>
    </PageShell>
  );
}

async function RecommendationsContent() {
  await connection();
  const payload = await getRecommendations(100).catch(() => null);
  const items: HomePoster[] =
    payload?.items.flatMap((item) =>
      item.posterPath
        ? [
            {
              key: `recommendation-${item.tmdbId}`,
              tmdbId: item.tmdbId,
              libraryFilmId: item.libraryFilmId,
              title: item.title,
              year: item.year,
              posterPath: item.posterPath,
              rating: Math.max(0, Math.min(5, item.voteAverage / 2)),
              badge: item.isWatchlist ? "From your watchlist" : undefined,
              reason: item.reasons[0],
            } satisfies HomePoster,
          ]
        : [],
    ) ?? [];
  const heading =
    payload?.mode === "trending" ? "Popular Right Now" : "Recommended For You";

  return (
    <div className="mx-auto max-w-7xl py-8 sm:py-12">
      <p className="type-label text-accent-400 tracking-[0.18em] uppercase">
        Your discovery feed
      </p>
      <h1 className="type-page-heading text-paper-100 mt-3">{heading}</h1>
      <p className="type-body text-paper-500 mt-3 max-w-2xl">
        Ranked from your ratings, genres, directors, watch history, and the
        films currently drawing attention.
      </p>
      <div className="mt-9">
        {items.length ? (
          <PosterGrid items={items} />
        ) : (
          <div className="border-hairline bg-ink-900 rounded-card border p-8">
            <p className="text-paper-300">
              Recommendations are temporarily unavailable. Add or rate films to
              keep shaping this feed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
