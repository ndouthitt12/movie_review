"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Input } from "@/components/input";
import { RcaChip } from "@/components/rca/rca-chip";
import { RcaMultiselect } from "@/components/rca/rca-multiselect";
import { Pill } from "@/components/ui/pill";
import { Stars } from "@/components/ui/stars";
import { rankFilms } from "@/lib/scoring";
import { tmdbImage } from "@/lib/tmdb";
import {
  compareLibraryValues,
  scoreWithinRange,
  validRcaFilterIds,
} from "@/lib/library";
import type { LibraryFilm } from "@/lib/catalog";
import type { RcaTagWithUsage } from "@/lib/rca";

const attributes = [
  "story",
  "direction",
  "writing",
  "acting",
  "music",
  "impact",
  "rewatchability",
  "genreFit",
] as const;
type SortKey =
  | "rank"
  | "title"
  | "releaseYear"
  | "lastWatchDate"
  | "overall"
  | (typeof attributes)[number];

export function LibraryView({
  films,
  genres,
  franchises,
  rcaTags,
}: {
  films: LibraryFilm[];
  genres: string[];
  franchises: string[];
  rcaTags: RcaTagWithUsage[];
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const status = params.get("status") ?? "watched";
  const isRatingView = status === "watched" || status === "rated";
  const view = params.get("view") ?? "table";
  const sort = (params.get("sort") ??
    (isRatingView ? "rank" : "title")) as SortKey;
  const direction = params.get("dir") === "desc" ? "desc" : "asc";
  const [ordered, setOrdered] = useState(() =>
    films
      .filter((film) => film.status === "to_watch")
      .sort((a, b) => (a.watchOrder ?? 9999) - (b.watchOrder ?? 9999)),
  );
  const [dragging, setDragging] = useState<number | null>(null);
  const [orderError, setOrderError] = useState("");
  const selectedRcaIds = useMemo(
    () =>
      validRcaFilterIds(
        params.get("rca"),
        rcaTags.map(({ id }) => id),
      ),
    [params, rcaTags],
  );

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (!value) next.delete(key);
    else next.set(key, value);
    if (key === "maxScore") next.delete("maxScoreExclusive");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function setDiscreteParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (!value) next.delete(key);
    else next.set(key, value);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function setStatus(value: string) {
    const next = new URLSearchParams(params.toString());
    next.set("status", value);
    next.delete("sort");
    next.delete("dir");
    next.delete("view");
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const ranks = useMemo(() => {
    const rated = films.filter(
      (film): film is LibraryFilm & { overall: number } =>
        film.overall !== null,
    );
    return new Map(rankFilms(rated).map(({ id, rank }) => [id, rank]));
  }, [films]);

  const filtered = useMemo(() => {
    const q = (params.get("q") ?? "").toLowerCase();
    const genre = params.get("genre");
    const franchise = params.get("franchise");
    const minYear = parameterNumber(params.get("minYear"), -Infinity);
    const maxYear = parameterNumber(params.get("maxYear"), Infinity);
    const minScore = parameterNumber(params.get("minScore"), -Infinity);
    const maxScore = parameterNumber(params.get("maxScore"), Infinity);
    const maxScoreExclusive = params.get("maxScoreExclusive") === "1";
    const rcaMode = params.get("rcaMode") === "all" ? "all" : "any";
    const base =
      status === "to_watch"
        ? ordered
        : status === "rated"
          ? films.filter(({ overall }) => overall !== null)
          : films.filter((film) => film.status === status);
    const result = base
      .filter(
        (film) => !q || `${film.title} ${film.notes}`.toLowerCase().includes(q),
      )
      .filter(
        (film) =>
          !genre ||
          film.genrePrimary === genre ||
          film.genreSecondary === genre,
      )
      .filter(
        (film) =>
          !franchise ||
          film.franchise === franchise ||
          film.subFranchise === franchise,
      )
      .filter(
        (film) => film.releaseYear >= minYear && film.releaseYear <= maxYear,
      )
      .filter((film) =>
        scoreWithinRange(film.overall, minScore, maxScore, maxScoreExclusive),
      )
      .filter((film) => {
        if (!selectedRcaIds.length) return true;
        const ids = new Set(film.rcaTags.map(({ id }) => id));
        return rcaMode === "all"
          ? selectedRcaIds.every((id) => ids.has(id))
          : selectedRcaIds.some((id) => ids.has(id));
      });
    return status === "to_watch"
      ? result
      : result.sort((a, b) => compare(a, b, sort, direction, ranks));
  }, [direction, films, ordered, params, ranks, selectedRcaIds, sort, status]);

  function changeSort(key: SortKey) {
    const nextDirection = sort === key && direction === "asc" ? "desc" : "asc";
    const next = new URLSearchParams(params.toString());
    next.set("sort", key);
    next.set("dir", nextDirection);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  async function persistOrder(next: LibraryFilm[]) {
    setOrdered(next);
    const response = await fetch("/api/films/reorder", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ filmIds: next.map(({ id }) => id) }),
    });
    if (!response.ok)
      setOrderError("Could not save the new order. Refresh and try again.");
    else {
      setOrderError("");
      router.refresh();
    }
  }

  async function drop(targetId: number) {
    if (dragging === null || dragging === targetId) return;
    const next = [...ordered];
    const from = next.findIndex(({ id }) => id === dragging);
    const to = next.findIndex(({ id }) => id === targetId);
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setDragging(null);
    await persistOrder(next);
  }

  async function move(filmId: number, delta: -1 | 1) {
    const next = [...ordered];
    const index = next.findIndex(({ id }) => id === filmId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    await persistOrder(next);
  }

  const hasFilters = [
    "q",
    "genre",
    "franchise",
    "minYear",
    "maxYear",
    "minScore",
    "maxScore",
    "maxScoreExclusive",
    "rca",
  ].some((key) => params.has(key));

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {[
          ["watched", "Watched"],
          ["rated", "All Rated"],
          ["to_watch", "To Watch"],
          ["to_rewatch", "To Re-Watch"],
        ].map(([value, label]) => (
          <Pill
            key={value}
            active={status === value}
            onClick={() => setStatus(value)}
          >
            {label}
          </Pill>
        ))}
        {isRatingView ? (
          <div className="flex gap-2 sm:ml-auto">
            <Pill
              active={view === "table"}
              onClick={() => setDiscreteParam("view", "table")}
            >
              Table
            </Pill>
            <Pill
              active={view === "grid"}
              onClick={() => setDiscreteParam("view", "grid")}
            >
              Posters
            </Pill>
          </div>
        ) : null}
      </div>

      <div className="border-hairline bg-ink-900 rounded-card mt-5 grid gap-3 border p-4 md:grid-cols-4 lg:grid-cols-8">
        <Input
          value={params.get("q") ?? ""}
          onChange={(event) => setParam("q", event.target.value)}
          placeholder="Search title or notes"
          className="md:col-span-2"
        />
        <FilterSelect
          value={params.get("genre") ?? ""}
          onChange={(value) => setDiscreteParam("genre", value)}
          label="All genres"
          options={genres}
        />
        <FilterSelect
          value={params.get("franchise") ?? ""}
          onChange={(value) => setDiscreteParam("franchise", value)}
          label="All franchises"
          options={franchises}
        />
        <Input
          aria-label="Minimum year"
          type="number"
          value={params.get("minYear") ?? ""}
          onChange={(event) => setParam("minYear", event.target.value)}
          placeholder="Year from"
        />
        <Input
          aria-label="Maximum year"
          type="number"
          value={params.get("maxYear") ?? ""}
          onChange={(event) => setParam("maxYear", event.target.value)}
          placeholder="Year to"
        />
        <Input
          aria-label="Minimum overall"
          type="number"
          step="0.1"
          value={params.get("minScore") ?? ""}
          onChange={(event) => setParam("minScore", event.target.value)}
          placeholder="Score from"
        />
        <Input
          aria-label="Maximum overall"
          type="number"
          step="0.1"
          value={params.get("maxScore") ?? ""}
          onChange={(event) => setParam("maxScore", event.target.value)}
          placeholder="Score to"
        />
        <div className="md:col-span-3 lg:col-span-3">
          <RcaMultiselect
            label="Filter by why tags"
            options={rcaTags}
            selectedIds={selectedRcaIds}
            onChange={(ids) =>
              setDiscreteParam("rca", ids.length ? ids.join(",") : null)
            }
            placeholder="Filter by why tags…"
          />
        </div>
        <select
          value={params.get("rcaMode") === "all" ? "all" : "any"}
          onChange={(event) =>
            setDiscreteParam(
              "rcaMode",
              event.target.value === "all" ? "all" : null,
            )
          }
          aria-label="Why tag match mode"
          className="select-field"
        >
          <option value="any">Match any tag</option>
          <option value="all">Match all tags</option>
        </select>
      </div>

      <p className="text-paper-500 my-5 text-xs tracking-widest uppercase">
        {filtered.length} {filtered.length === 1 ? "film" : "films"}
      </p>
      {orderError ? (
        <p className="text-accent-400 mb-4 text-sm">{orderError}</p>
      ) : null}
      {status === "to_watch" && hasFilters ? (
        <p className="text-paper-500 mb-4 text-xs">
          Clear filters to drag and persist the complete watchlist order.
        </p>
      ) : null}
      {filtered.length === 0 ? (
        <EmptyState />
      ) : status === "to_watch" ? (
        <WatchOrderList
          films={filtered}
          draggable={!hasFilters}
          onDrag={setDragging}
          onDrop={drop}
          onMove={move}
        />
      ) : status === "to_rewatch" ? (
        <RewatchList films={filtered} />
      ) : view === "grid" && isRatingView ? (
        <PosterGrid films={filtered} />
      ) : (
        <FilmTable
          films={filtered}
          ranks={ranks}
          sort={sort}
          direction={direction}
          onSort={changeSort}
        />
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="select-field bg-ink-850"
    >
      <option value="">{label}</option>
      {options.map((option) => (
        <option key={option}>{option}</option>
      ))}
    </select>
  );
}

function FilmTable({
  films,
  ranks,
  sort,
  direction,
  onSort,
}: {
  films: LibraryFilm[];
  ranks: Map<number, number>;
  sort: SortKey;
  direction: string;
  onSort: (key: SortKey) => void;
}) {
  const columns: Array<[SortKey, string]> = [
    ["rank", "Rank"],
    ["title", "Title"],
    ["releaseYear", "Year"],
    ...attributes.map(
      (key) =>
        [
          key,
          key === "genreFit" ? "Genre" : key[0].toUpperCase() + key.slice(1),
        ] as [SortKey, string],
    ),
    ["overall", "Overall"],
    ["lastWatchDate", "Last watch"],
  ];
  return (
    <div className="border-hairline bg-ink-900 rounded-card max-h-[70vh] overflow-auto border">
      <table className="w-full min-w-[1100px] border-collapse text-left text-xs tabular-nums">
        <thead className="bg-ink-850 text-paper-500 sticky top-0 z-10">
          <tr>
            {columns.map(([key, label]) => (
              <th
                key={key}
                className={`border-hairline border-b px-3 py-3 font-medium tracking-wider uppercase ${["rank", ...attributes, "overall"].includes(key) ? "text-right" : ""}`}
              >
                <button onClick={() => onSort(key)}>
                  {label}
                  {sort === key ? (direction === "asc" ? " ↑" : " ↓") : ""}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {films.map((film) => (
            <tr key={film.id} className="bg-ink-900 hover:bg-ink-850">
              <td className="border-hairline text-paper-500 border-b px-3 py-2 text-right">
                {ranks.get(film.id) ?? "—"}
              </td>
              <td className="border-hairline border-b px-3 py-2">
                <Link
                  href={`/films/${film.id}`}
                  className="text-paper-100 hover:text-accent-400 font-medium"
                >
                  {film.title}
                </Link>
                {film.rcaTags.length ? (
                  <div className="mt-1.5 flex max-w-xs flex-wrap gap-1">
                    {film.rcaTags.slice(0, 3).map((tag) => (
                      <RcaChip key={tag.id} tag={tag} compact />
                    ))}
                    {film.rcaTags.length > 3 ? (
                      <span className="text-paper-500 text-[10px]">
                        +{film.rcaTags.length - 3}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </td>
              <td className="border-hairline text-paper-500 border-b px-3 py-2">
                {film.releaseYear}
              </td>
              {attributes.map((key) => (
                <td
                  key={key}
                  className="border-hairline text-paper-300 border-b px-3 py-2 text-right"
                >
                  {film[key] ?? "—"}
                </td>
              ))}
              <td className="border-hairline text-accent-400 border-b px-3 py-2 text-right font-semibold">
                {film.overall?.toFixed(3) ?? "—"}
              </td>
              <td className="border-hairline text-paper-500 border-b px-3 py-2">
                {film.lastWatchDate ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PosterGrid({ films }: { films: LibraryFilm[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {films.map((film) => (
        <Link key={film.id} href={`/films/${film.id}`} className="group">
          <div className="poster-frame relative aspect-[2/3] overflow-hidden">
            {film.posterPath ? (
              <Image
                src={tmdbImage(film.posterPath, "w342")!}
                alt={`${film.title} poster`}
                fill
                sizes="(max-width: 640px) 50vw, 16vw"
                className="object-cover transition-opacity group-hover:opacity-80"
              />
            ) : (
              <div className="text-paper-500 flex h-full items-center justify-center p-4 text-center font-serif">
                {film.title}
              </div>
            )}
            <div className="bg-ink-950/95 absolute inset-x-0 bottom-0 translate-y-full p-3 transition-transform duration-200 group-hover:translate-y-0 group-focus-visible:translate-y-0">
              <p className="text-accent-400 text-xl font-bold tabular-nums">
                {film.overall?.toFixed(3) ?? "Unrated"}
              </p>
              {film.overall !== null ? (
                <Stars value={film.overall / 2} className="mt-1 text-sm" />
              ) : null}
              {film.rcaTags.length ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {film.rcaTags.slice(0, 4).map((tag) => (
                    <RcaChip key={tag.id} tag={tag} compact />
                  ))}
                </div>
              ) : (
                <p className="text-paper-500 mt-1 text-[10px]">
                  No why tags yet
                </p>
              )}
            </div>
          </div>
          <h3 className="text-paper-100 mt-2 truncate text-sm font-medium">
            {film.title}
          </h3>
          <p className="text-paper-500 mt-1 text-xs">
            {film.releaseYear}{" "}
            {film.overall !== null ? `· ${film.overall.toFixed(3)}` : ""}
          </p>
        </Link>
      ))}
    </div>
  );
}

function WatchOrderList({
  films,
  draggable,
  onDrag,
  onDrop,
  onMove,
}: {
  films: LibraryFilm[];
  draggable: boolean;
  onDrag: (id: number) => void;
  onDrop: (id: number) => void;
  onMove: (id: number, delta: -1 | 1) => void;
}) {
  return (
    <ol className="divide-hairline border-hairline bg-ink-900 rounded-card divide-y overflow-hidden border">
      {films.map((film, index) => (
        <li
          key={film.id}
          draggable={draggable}
          onDragStart={() => onDrag(film.id)}
          onDragOver={(event) => {
            if (draggable) event.preventDefault();
          }}
          onDrop={() => onDrop(film.id)}
          className={`hover:bg-ink-850 grid grid-cols-[3rem_1fr_auto] items-center gap-3 px-4 py-3 ${draggable ? "cursor-grab" : ""}`}
        >
          <span className="text-accent-400 text-sm tabular-nums">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div>
            <Link
              href={`/films/${film.id}`}
              className="text-paper-100 hover:text-accent-400 font-medium"
            >
              {film.title}
            </Link>
            <p className="text-paper-500 mt-1 text-xs">
              {film.releaseYear} · {film.genrePrimary ?? "Unclassified"}
            </p>
          </div>
          <span className="flex items-center gap-1">
            <button
              type="button"
              disabled={!draggable || index === 0}
              onClick={() => onMove(film.id, -1)}
              aria-label={`Move ${film.title} up`}
              className="rounded-ui border-hairline text-paper-500 hover:text-paper-100 border px-2 py-1 text-xs disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              disabled={!draggable || index === films.length - 1}
              onClick={() => onMove(film.id, 1)}
              aria-label={`Move ${film.title} down`}
              className="rounded-ui border-hairline text-paper-500 hover:text-paper-100 border px-2 py-1 text-xs disabled:opacity-30"
            >
              ↓
            </button>
          </span>
        </li>
      ))}
    </ol>
  );
}

function RewatchList({ films }: { films: LibraryFilm[] }) {
  return (
    <ul className="divide-hairline border-hairline bg-ink-900 rounded-card divide-y overflow-hidden border">
      {films.map((film) => (
        <li
          key={film.id}
          className="hover:bg-ink-850 grid gap-2 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center"
        >
          <div>
            <Link
              href={`/films/${film.id}`}
              className="text-paper-100 hover:text-accent-400 font-medium"
            >
              {film.title}
            </Link>
            <p className="text-paper-500 mt-1 text-xs">
              {film.releaseYear} · {film.genrePrimary ?? "Unclassified"}
            </p>
          </div>
          <p className="text-paper-500 text-xs tabular-nums">
            Last watched {film.lastWatchDate ?? "unknown"}
          </p>
        </li>
      ))}
    </ul>
  );
}

function EmptyState() {
  return (
    <div className="border-hairline bg-ink-900 rounded-card border py-16 text-center">
      <h2 className="text-paper-100 font-serif text-3xl">
        No films in this cut.
      </h2>
      <p className="text-paper-500 mt-3 text-sm">
        Adjust the filters or add something new.
      </p>
    </div>
  );
}

function compare(
  a: LibraryFilm,
  b: LibraryFilm,
  key: SortKey,
  direction: string,
  ranks: Map<number, number>,
) {
  const av = key === "rank" ? (ranks.get(a.id) ?? Infinity) : a[key];
  const bv = key === "rank" ? (ranks.get(b.id) ?? Infinity) : b[key];
  return compareLibraryValues(av, bv, direction === "desc" ? "desc" : "asc");
}

function parameterNumber(value: string | null, fallback: number) {
  if (value === null || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
