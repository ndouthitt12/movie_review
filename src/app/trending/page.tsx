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
import { getTrending } from "@/lib/recs-server";
import { getScoreScale } from "@/lib/score-scale";

export const unstable_instant = { prefetch: "static" };
export const metadata: Metadata = { title: "Trending" };

export default function TrendingPage() {
  return (
    <PageShell>
      <SectionHeader
        title="Discover"
        description="This week's popular films, lightly reordered around your taste. Films already in your library are marked."
        tabs={discoverTabs}
      />
      <Suspense
        fallback={<RouteContentLoading label="Loading trending films" />}
      >
        <TrendingContent />
      </Suspense>
    </PageShell>
  );
}

async function TrendingContent() {
  await connection();
  const scale = await getScoreScale();
  const payload = await getTrending(scale, 100).catch(() => null);
  const items: DiscoverPoster[] =
    payload?.items.map((item) => ({
      key: `trending-${item.tmdbId}`,
      tmdbId: item.tmdbId,
      libraryFilmId: item.libraryFilmId,
      title: item.title,
      year: item.year,
      posterPath: item.posterPath,
      rating: item.rating,
      badge: item.badge,
    })) ?? [];

  return items.length ? (
    <PosterGrid items={items} />
  ) : (
    <div className="border-hairline bg-ink-900 rounded-card border p-8">
      <p className="text-paper-300">
        Trending films are not available right now. Your library still works as
        normal.
      </p>
    </div>
  );
}
