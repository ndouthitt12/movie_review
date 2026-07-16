import { Suspense } from "react";
import { connection } from "next/server";
import { PageShell } from "@/components/page-shell";
import { RouteContentLoading } from "@/components/route-content-loading";
import { PosterGrid, type HomePoster } from "@/components/home/poster-rail";
import { getTrending } from "@/lib/recs-server";

export const unstable_instant = { prefetch: "static" };

export default function TrendingPage() {
  return (
    <PageShell>
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
  const payload = await getTrending(100).catch(() => null);
  const items: HomePoster[] =
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

  return (
    <div className="mx-auto max-w-7xl py-8 sm:py-12">
      <p className="type-label text-accent-400 tracking-[0.18em] uppercase">
        Discover
      </p>
      <h1 className="type-page-heading text-paper-100 mt-3">Trending Now</h1>
      <p className="type-body text-paper-500 mt-3 max-w-2xl">
        This week&apos;s popular films, lightly reordered around your taste and
        marked when they are already in your library.
      </p>
      <div className="mt-9">
        {items.length ? (
          <PosterGrid items={items} />
        ) : (
          <EmptyState message="Trending films are temporarily unavailable. Your library is still fully usable." />
        )}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="border-hairline bg-ink-900 rounded-card border p-8">
      <p className="text-paper-300">{message}</p>
    </div>
  );
}
