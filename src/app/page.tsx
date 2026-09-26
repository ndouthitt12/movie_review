import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { PageShell } from "@/components/page-shell";
import { RouteContentLoading } from "@/components/route-content-loading";
import {
  RankingsView,
  type RankedFilm,
} from "@/components/rankings/rankings-view";
import { getLibraryFilms, type LibraryFilm } from "@/lib/catalog";
import {
  franchiseAverages,
  lastWatchedFilm,
  rankedFilms,
  scoreSpread,
  upNextFilms,
} from "@/lib/rankings";
import { formatRuntime } from "@/lib/runtime-format";
import { displayScore, formatScore, type ScoreScale } from "@/lib/score-format";
import { getScoreScale } from "@/lib/score-scale";
import { tmdbImage } from "@/lib/tmdb";

// No unstable_instant here. Its runtime prefetch check made `next build`
// hang on this page (Next.js 16.2.10), so production deploys failed.

export default function RankingsPage() {
  return (
    <PageShell>
      <Suspense fallback={<RouteContentLoading label="Loading rankings" />}>
        <RankingsContent />
      </Suspense>
    </PageShell>
  );
}

async function RankingsContent() {
  await connection();
  const [films, scale] = await Promise.all([
    getLibraryFilms(),
    getScoreScale(),
  ]);
  const ranked = rankedFilms(films);
  const average = ranked.length
    ? ranked.reduce((sum, { overall }) => sum + overall, 0) / ranked.length
    : null;
  const lastWatched = lastWatchedFilm(films);
  const lastWatchedRank = ranked.find(({ id }) => id === lastWatched?.id)?.rank;
  const rows: RankedFilm[] = ranked.map((film) => ({
    id: film.id,
    rank: film.rank,
    title: film.title,
    releaseYear: film.releaseYear,
    runtime: film.runtime,
    franchise: film.franchise,
    director: film.director,
    posterPath: film.posterPath,
    overall: film.overall,
  }));

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_336px]">
      <div className="min-w-0">
        <header className="mb-5">
          <h1 className="type-page-heading text-paper-100 tracking-[-0.02em]">
            Your rankings
          </h1>
          <p className="text-paper-500 mt-2 text-sm">
            {ranked.length
              ? `${ranked.length} rated ${ranked.length === 1 ? "film" : "films"} · average ${formatScore(average, scale)} out of ${scale}`
              : "Rate a film to start your rankings."}
          </p>
        </header>
        {rows.length ? (
          <RankingsView
            films={rows}
            highlightId={lastWatched?.id ?? null}
            scale={scale}
          />
        ) : (
          <div className="border-hairline bg-ink-900 rounded-card border p-8">
            <p className="text-paper-300">
              No rated films yet. Use <strong>Rate a film</strong> in the top
              bar to rate your first one.
            </p>
          </div>
        )}
      </div>

      <aside className="grid content-start gap-4 sm:grid-cols-2 xl:grid-cols-1">
        {ranked.length ? (
          <Card title="Score spread">
            <ScoreSpreadChart
              overalls={ranked.map(({ overall }) => overall)}
              scale={scale}
            />
          </Card>
        ) : null}
        {lastWatched ? (
          <Card
            title={`Last watched · ${formatDate(lastWatched.lastWatchDate!)}`}
          >
            <LastWatched
              film={lastWatched}
              rank={lastWatchedRank}
              total={ranked.length}
              scale={scale}
            />
          </Card>
        ) : null}
        <FranchiseCard films={films} scale={scale} />
        <UpNextCard films={films} />
      </aside>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-hairline bg-ink-900 rounded-card border px-[18px] py-4">
      <h2 className="text-paper-500 mb-3 text-[0.68rem] font-semibold tracking-[0.12em] uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ScoreSpreadChart({
  overalls,
  scale,
}: {
  overalls: number[];
  scale: ScoreScale;
}) {
  const bins = scoreSpread(overalls, scale);
  const max = Math.max(...bins.map(({ count }) => count), 1);
  const width = 296;
  const baseline = 112;
  const chartHeight = 84;
  const step = (width - 16) / bins.length;
  const barWidth = Math.min(38, step - 10);
  return (
    <svg
      viewBox={`0 0 ${width} 136`}
      className="w-full"
      role="img"
      aria-label={`Films per score range: ${bins.map(({ label, count }) => `${label}: ${count}`).join(", ")}`}
    >
      <rect
        x="8"
        y={baseline}
        width={width - 16}
        height="1"
        className="fill-ink-800"
      />
      {bins.map((bin, index) => {
        const height = Math.round((bin.count / max) * chartHeight);
        const x = 8 + index * step + (step - barWidth) / 2;
        const center = x + barWidth / 2;
        return (
          <g key={bin.label}>
            {height ? (
              <rect
                x={x}
                y={baseline - height}
                width={barWidth}
                height={height}
                rx="3"
                className="fill-accent-400"
              />
            ) : null}
            <text
              x={center}
              y={baseline - height - 6}
              textAnchor="middle"
              fontSize="12"
              className="fill-paper-100 font-mono"
            >
              {bin.count}
            </text>
            <text
              x={center}
              y={baseline + 17}
              textAnchor="middle"
              fontSize={bins.length > 6 ? 8 : 10}
              className="fill-paper-500 font-mono"
            >
              {bins.length > 6 ? bin.start.toFixed(1) : bin.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function LastWatched({
  film,
  rank,
  total,
  scale,
}: {
  film: LibraryFilm;
  rank: number | undefined;
  total: number;
  scale: ScoreScale;
}) {
  return (
    <Link
      href={`/films/${film.id}`}
      className="group flex items-center gap-3.5"
    >
      <Poster path={film.posterPath} className="h-[78px] w-[52px]" />
      <span className="grid min-w-0 gap-0.5">
        <span className="text-paper-100 group-hover:text-accent-300 truncate text-[1.05rem] font-bold">
          {film.title}
        </span>
        <span className="text-paper-500 text-xs">
          {[film.releaseYear, formatRuntime(film.runtime, "")]
            .filter(Boolean)
            .join(" · ")}
        </span>
        <span className="text-accent-400 mt-1 font-mono text-[0.8rem] font-semibold">
          {film.overall === null
            ? "Not rated yet"
            : `${formatScore(film.overall, scale)}${rank ? ` · ranked ${ordinal(rank)} of ${total}` : ""}`}
        </span>
      </span>
    </Link>
  );
}

function FranchiseCard({
  films,
  scale,
}: {
  films: LibraryFilm[];
  scale: ScoreScale;
}) {
  const franchises = franchiseAverages(films).slice(0, 5);
  if (!franchises.length) return null;
  return (
    <Card title="Franchise averages">
      <ul className="divide-hairline divide-y">
        {franchises.map((franchise) => (
          <li key={franchise.name} className="py-2 first:pt-0 last:pb-0">
            <Link
              href={`/library?status=rated&franchise=${encodeURIComponent(franchise.name)}`}
              className="group grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-sm"
            >
              <span className="text-paper-100 group-hover:text-accent-300 truncate">
                {franchise.name}{" "}
                <span className="text-paper-500 text-xs">
                  · {franchise.count} rated
                </span>
              </span>
              <span className="text-paper-100 font-mono font-semibold tabular-nums">
                {formatScore(franchise.average, scale)}
              </span>
              <span className="bg-ink-850 col-span-2 h-1 overflow-hidden rounded-full">
                <span
                  className="bg-accent-400 block h-full"
                  style={{
                    width: `${(displayScore(franchise.average, scale) / scale) * 100}%`,
                  }}
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function UpNextCard({ films }: { films: LibraryFilm[] }) {
  const upNext = upNextFilms(films).slice(0, 4);
  return (
    <Card title="Up next">
      {upNext.length ? (
        <ul className="grid gap-3">
          {upNext.map((film) => (
            <li key={film.id}>
              <Link
                href={`/films/${film.id}`}
                className="group flex items-center gap-3 text-sm"
              >
                <Poster path={film.posterPath} className="h-[51px] w-[34px]" />
                <span className="grid min-w-0">
                  <span className="text-paper-100 group-hover:text-accent-300 truncate">
                    {film.title}
                  </span>
                  <span className="text-paper-500 text-xs">
                    {[film.releaseYear, formatRuntime(film.runtime, "")]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className="text-accent-400 border-accent-400/40 ml-auto shrink-0 rounded-md border px-2 py-0.5 text-xs">
                  {film.status === "to_rewatch" ? "Rewatch" : "To watch"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-paper-500 text-sm">
          Your watchlist is empty. Add films from{" "}
          <Link
            href="/trending"
            className="text-accent-400 hover:text-accent-300"
          >
            Discover
          </Link>
          .
        </p>
      )}
      <Link
        href="/watchlist"
        className="text-accent-400 hover:text-accent-300 mt-3 inline-block text-xs font-medium"
      >
        Open watchlist
      </Link>
    </Card>
  );
}

function Poster({
  path,
  className,
}: {
  path: string | null;
  className: string;
}) {
  return (
    <span
      className={`bg-ink-800 relative shrink-0 overflow-hidden rounded ${className}`}
    >
      {path ? (
        <Image
          src={tmdbImage(path, "w185")!}
          alt=""
          fill
          sizes="52px"
          className="object-cover"
        />
      ) : null}
    </span>
  );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function ordinal(value: number) {
  const suffix =
    value % 100 >= 11 && value % 100 <= 13
      ? "th"
      : (({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[
          value % 10
        ] ?? "th");
  return `${value}${suffix}`;
}
