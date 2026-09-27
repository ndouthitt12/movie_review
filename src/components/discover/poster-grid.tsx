"use client";

import Image from "next/image";
import Link from "next/link";
import { useFilmActions } from "@/components/film-actions-provider";
import { tmdbImage } from "@/lib/tmdb";

export type DiscoverPoster = {
  key: string;
  tmdbId: number | null;
  libraryFilmId: number | null;
  title: string;
  year?: number | null;
  posterPath: string;
  /** On the display scale, out of 5 or 10. */
  rating: number;
  reason?: string;
  badge?: string;
};

export function PosterGrid({ items }: { items: DiscoverPoster[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((item, index) => (
        // The first row loads at once. Lazy loading left it blank for seconds.
        <PosterCard key={item.key} item={item} eager={index < 6} />
      ))}
    </div>
  );
}

function PosterCard({ item, eager }: { item: DiscoverPoster; eager: boolean }) {
  const { openTmdbMovie } = useFilmActions();
  const frame = (
    <span className="poster-frame relative block aspect-[2/3] max-w-full overflow-hidden">
      {/* Shown until the poster loads over it. */}
      <span className="text-paper-500 absolute inset-0 flex items-center justify-center p-3 text-center text-xs">
        {item.title}
      </span>
      <Image
        src={tmdbImage(item.posterPath, "w342")!}
        alt=""
        fill
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
        className="object-cover"
      />
      <span className="bg-ink-950/85 text-paper-100 absolute top-2 left-2 rounded-md px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums">
        ★ {item.rating.toFixed(1)}
      </span>
    </span>
  );
  const label = `${item.title}${item.year ? ` (${item.year})` : ""}`;

  return (
    <div className="group min-w-0">
      {item.libraryFilmId ? (
        <Link
          href={`/films/${item.libraryFilmId}`}
          aria-label={`Open ${label}`}
        >
          {frame}
        </Link>
      ) : (
        <button
          type="button"
          className="block w-full text-left"
          aria-label={`Add ${label} to your library`}
          onClick={() => {
            if (item.tmdbId)
              openTmdbMovie({ tmdbId: item.tmdbId, title: item.title });
          }}
        >
          {frame}
        </button>
      )}
      <p className="text-paper-100 mt-2 line-clamp-2 text-sm font-semibold">
        {label}
      </p>
      {item.badge ? (
        <p className="text-accent-400 mt-1 text-xs font-medium">{item.badge}</p>
      ) : null}
      {item.reason ? (
        <p className="text-paper-500 mt-1 line-clamp-2 text-xs">
          {item.reason}
        </p>
      ) : null}
    </div>
  );
}
