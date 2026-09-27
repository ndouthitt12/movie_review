"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { ScoreBar } from "@/components/ui/score-bar";
import { formatRuntime } from "@/lib/runtime-format";
import { formatScore, type ScoreScale } from "@/lib/score-format";
import { tmdbImage } from "@/lib/tmdb";

export type RankedFilm = {
  id: number;
  rank: number;
  title: string;
  releaseYear: number;
  runtime: number | null;
  franchise: string | null;
  director: string | null;
  posterPath: string | null;
  overall: number;
};

type Grouping = "all" | "franchise" | "decade";

const groupings: Array<[Grouping, string]> = [
  ["all", "All films"],
  ["franchise", "By franchise"],
  ["decade", "By decade"],
];

export function RankingsView({
  films,
  highlightId,
  scale,
}: {
  films: RankedFilm[];
  highlightId: number | null;
  scale: ScoreScale;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requested = params.get("group");
  const grouping: Grouping =
    requested === "franchise" || requested === "decade" ? requested : "all";

  const groups = useMemo(() => groupFilms(films, grouping), [films, grouping]);

  function setGrouping(value: Grouping) {
    const next = new URLSearchParams(params.toString());
    if (value === "all") next.delete("group");
    else next.set("group", value);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Group rankings"
        className="border-hairline bg-ink-900 rounded-ui inline-flex border p-[3px]"
      >
        {groupings.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={grouping === value}
            onClick={() => setGrouping(value)}
            className={`rounded-md px-3 py-2.5 text-[0.8rem] transition-colors sm:py-1.5 ${
              grouping === value
                ? "bg-ink-850 text-paper-100"
                : "text-paper-500 hover:text-paper-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-8">
        {groups.map((group) => (
          <section
            key={group.label || "all"}
            aria-label={group.label || "All films"}
          >
            {group.label ? (
              <header className="mb-2 flex items-baseline justify-between gap-4">
                <h2 className="type-section-heading text-paper-100">
                  {group.label}
                </h2>
                <p className="text-paper-500 font-mono text-xs tabular-nums">
                  {group.films.length}{" "}
                  {group.films.length === 1 ? "film" : "films"} · average{" "}
                  {formatScore(group.average, scale)}
                </p>
              </header>
            ) : null}
            <RankTable
              films={group.films}
              highlightId={highlightId}
              scale={scale}
            />
          </section>
        ))}
      </div>
    </div>
  );
}

function RankTable({
  films,
  highlightId,
  scale,
}: {
  films: RankedFilm[];
  highlightId: number | null;
  scale: ScoreScale;
}) {
  return (
    // Fixed column widths keep the columns aligned across grouped tables.
    <table className="w-full table-fixed border-collapse text-left text-sm">
      <thead>
        <tr className="text-paper-500 border-hairline border-b text-[0.68rem] font-semibold tracking-[0.12em] uppercase">
          <th scope="col" className="w-8 pb-2.5 font-semibold sm:w-10">
            #
          </th>
          <th scope="col" className="pb-2.5 font-semibold">
            Film
          </th>
          <th
            scope="col"
            className="hidden w-16 pb-2.5 font-semibold md:table-cell"
          >
            Year
          </th>
          <th
            scope="col"
            className="hidden w-24 pb-2.5 font-semibold lg:table-cell"
          >
            Runtime
          </th>
          <th scope="col" className="w-14 pb-2.5 font-semibold sm:w-44 xl:w-52">
            Score
          </th>
        </tr>
      </thead>
      <tbody>
        {films.map((film) => {
          const highlight = film.id === highlightId;
          return (
            <tr
              key={film.id}
              className={`border-hairline hover:bg-ink-900 border-b transition-colors ${
                highlight ? "bg-accent-400/[0.07]" : ""
              }`}
            >
              <td
                className={`py-2 pr-2 font-mono text-[0.95rem] font-semibold tabular-nums ${
                  highlight ? "text-accent-400" : "text-paper-500"
                }`}
              >
                {film.rank}
              </td>
              <td>
                <Link
                  href={`/films/${film.id}`}
                  className="group flex min-w-0 items-center gap-3 py-2 pr-3"
                >
                  <span className="bg-ink-800 relative h-[42px] w-7 shrink-0 overflow-hidden rounded-[3px]">
                    {film.posterPath ? (
                      <Image
                        src={tmdbImage(film.posterPath, "w185")!}
                        alt=""
                        fill
                        sizes="28px"
                        className="object-cover"
                      />
                    ) : null}
                  </span>
                  <span className="grid min-w-0">
                    <span className="text-paper-100 group-hover:text-accent-300 line-clamp-2 font-semibold sm:line-clamp-1">
                      {film.title}
                    </span>
                    <span className="text-paper-500 truncate text-xs">
                      {film.franchise || film.director || " "}
                      {highlight ? " · last watched" : ""}
                    </span>
                  </span>
                </Link>
              </td>
              <td className="text-paper-300 hidden py-2 pr-3 font-mono text-[0.8rem] tabular-nums md:table-cell">
                {film.releaseYear}
              </td>
              <td className="text-paper-300 hidden py-2 pr-3 font-mono text-[0.8rem] tabular-nums lg:table-cell">
                {formatRuntime(film.runtime)}
              </td>
              <td className="py-2">
                <ScoreBar
                  overall={film.overall}
                  scale={scale}
                  // Phones drop the bar so the title has room.
                  trackClassName="hidden sm:block sm:w-28 xl:w-36"
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function groupFilms(films: RankedFilm[], grouping: Grouping) {
  if (grouping === "all") return [{ label: "", films, average: null }];
  const groups = new Map<string, RankedFilm[]>();
  for (const film of films) {
    const label =
      grouping === "franchise"
        ? film.franchise || "Standalone films"
        : `${Math.floor(film.releaseYear / 10) * 10}s`;
    groups.set(label, [...(groups.get(label) ?? []), film]);
  }
  return [...groups]
    .map(([label, members]) => ({
      label,
      films: members,
      average:
        members.reduce((sum, { overall }) => sum + overall, 0) / members.length,
    }))
    .sort((left, right) => {
      if (grouping === "decade") return right.label.localeCompare(left.label);
      if (left.label === "Standalone films") return 1;
      if (right.label === "Standalone films") return -1;
      return right.average - left.average;
    });
}
