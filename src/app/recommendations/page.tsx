import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { PageShell } from "@/components/page-shell";
import { RouteContentLoading } from "@/components/route-content-loading";
import {
  PosterGrid,
  type DiscoverPoster,
} from "@/components/discover/poster-grid";
import { discoverTabs, SectionHeader } from "@/components/section-header";
import { getRecommendations } from "@/lib/recs-server";
import { displayScore } from "@/lib/score-format";
import { getScoreScale } from "@/lib/score-scale";

export const unstable_instant = { prefetch: "static" };
export const metadata: Metadata = { title: "For you" };

export default function RecommendationsPage() {
  return (
    <PageShell>
      <SectionHeader
        title="Discover"
        description="Picked from your ratings, genres, directors and watch history. When there is not enough to go on, this shows popular films."
        tabs={discoverTabs}
      />
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
  const scale = await getScoreScale();
  const payload = await getRecommendations(scale, 100).catch(() => null);
  const items: DiscoverPoster[] =
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
              rating: displayScore(item.voteAverage, scale),
              badge: item.isWatchlist ? "On your watchlist" : undefined,
              reason: item.reasons[0],
            } satisfies DiscoverPoster,
          ]
        : [],
    ) ?? [];

  return items.length ? (
    <>
      {payload?.mode === "trending" ? (
        <p className="text-paper-500 mb-5 text-sm">
          Showing popular films until you rate more.
        </p>
      ) : null}
      <PosterGrid items={items} />
    </>
  ) : (
    <div className="border-hairline bg-ink-900 rounded-card border p-8">
      <p className="text-paper-300">
        Recommendations are not available right now. Add or rate films to shape
        this list.
      </p>
    </div>
  );
}
