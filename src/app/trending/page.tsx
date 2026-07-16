import { PageShell } from "@/components/page-shell";
import {
  PosterGrid,
  type HomePoster,
} from "@/components/home/poster-rail";
import { getTrending } from "@/lib/recs-server";

export const dynamic = "force-dynamic";

export default async function TrendingPage() {
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
    <PageShell>
      <div className="mx-auto max-w-7xl py-8 sm:py-12">
        <p className="text-accent-400 text-xs font-semibold tracking-[0.18em] uppercase">
          Discover
        </p>
        <h1 className="text-paper-100 mt-3 font-serif text-4xl sm:text-5xl">
          Trending Now
        </h1>
        <p className="text-paper-500 mt-3 max-w-2xl text-sm leading-6">
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
    </PageShell>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="border-hairline bg-ink-900 rounded-card border p-8">
      <p className="text-paper-300">{message}</p>
    </div>
  );
}
