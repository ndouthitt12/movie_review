"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Button, QuietButton } from "@/components/button";
import { Input } from "@/components/input";
import {
  tmdbImage,
  type TmdbMovieDetails,
  type TmdbSearchResult,
} from "@/lib/tmdb";

type Props = { genres: string[]; franchiseNames: string[] };

export function AddFilmDialog({ genres, franchiseNames }: Props) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TmdbSearchResult[]>([]);
  const [selected, setSelected] = useState<TmdbMovieDetails | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const close = useCallback(() => {
    setOpen(false);
    setSelected(null);
    setManual(false);
    setError("");
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [
        ...dialogRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]",
        ),
      ];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [close, open]);

  useEffect(() => {
    if (!open || manual || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setError("");
      try {
        const response = await fetch(
          `/api/tmdb/search?q=${encodeURIComponent(query.trim())}`,
          {
            signal: controller.signal,
          },
        );
        const body = (await response.json()) as {
          results?: TmdbSearchResult[];
          error?: string;
        };
        if (!response.ok) throw new Error(body.error ?? "Search failed.");
        setResults(body.results ?? []);
      } catch (caught) {
        if (!controller.signal.aborted)
          setError(caught instanceof Error ? caught.message : "Search failed.");
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [manual, open, query]);

  async function choose(result: TmdbSearchResult) {
    setSearching(true);
    setError("");
    try {
      const response = await fetch(`/api/tmdb/movie/${result.id}`);
      const body = (await response.json()) as TmdbMovieDetails & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(body.error ?? "Could not load movie details.");
      setSelected(body);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not load movie details.",
      );
    } finally {
      setSearching(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const status = String(data.get("status"));
    const payload = {
      tmdbId: selected?.id ?? null,
      title: selected?.title ?? String(data.get("title") ?? ""),
      releaseYear: selected?.year ?? Number(data.get("releaseYear")),
      status,
      watchOrder:
        status === "to_watch" && data.get("watchOrder")
          ? Number(data.get("watchOrder"))
          : null,
      genrePrimary: String(data.get("genrePrimary") ?? "").trim() || null,
      genreSecondary: String(data.get("genreSecondary") ?? "").trim() || null,
      franchiseName: String(data.get("franchiseName") ?? "").trim() || null,
      subFranchiseName:
        String(data.get("subFranchiseName") ?? "").trim() || null,
      notes: String(data.get("notes") ?? ""),
      posterPath: selected?.posterPath ?? null,
      backdropPath: selected?.backdropPath ?? null,
      runtime:
        selected?.runtime ??
        (data.get("runtime") ? Number(data.get("runtime")) : null),
      director:
        selected?.director ??
        (String(data.get("director") ?? "").trim() || null),
      overview: selected?.overview ?? String(data.get("overview") ?? ""),
      tmdbGenres: selected?.genres ?? [],
    };
    try {
      const response = await fetch("/api/films", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { id?: number; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not add film.");
      router.push(`/films/${body.id}`);
      router.refresh();
      setOpen(false);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not add film.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button ref={triggerRef} onClick={() => setOpen(true)}>
        Add film
      </Button>
      {open ? (
        <div
          className="bg-ink-950/95 fixed inset-0 z-50 overflow-y-auto px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-film-title"
          ref={dialogRef}
        >
          <div className="rounded-card border-hairline bg-ink-900 mx-auto max-w-3xl border p-5 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-accent-400 text-xs tracking-[0.2em] uppercase">
                  Library intake
                </p>
                <h2
                  id="add-film-title"
                  className="text-paper-100 mt-2 font-serif text-3xl"
                >
                  Add a film
                </h2>
              </div>
              <QuietButton onClick={close} aria-label="Close add film dialog">
                Close
              </QuietButton>
            </div>

            {!selected && !manual ? (
              <div className="mt-8">
                <label className="text-paper-500 text-xs tracking-widest uppercase">
                  Search TMDB
                  <Input
                    autoFocus
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      if (event.target.value.trim().length < 2) setResults([]);
                    }}
                    className="mt-2"
                    placeholder="Title"
                  />
                </label>
                <p className="text-paper-500 mt-3 text-xs">
                  {searching
                    ? "Searching…"
                    : "Results include year and director."}
                </p>
                <div className="divide-hairline border-hairline rounded-ui mt-5 divide-y overflow-hidden border">
                  {results.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => choose(result)}
                      className="hover:bg-ink-850 flex w-full items-center gap-4 px-3 py-3 text-left"
                    >
                      <div className="bg-ink-800 relative h-16 w-11 shrink-0 overflow-hidden">
                        {result.posterPath ? (
                          <Image
                            src={tmdbImage(result.posterPath, "w185")!}
                            alt=""
                            fill
                            sizes="44px"
                            className="object-cover"
                          />
                        ) : null}
                      </div>
                      <div>
                        <p className="text-paper-100 font-medium">
                          {result.title}
                        </p>
                        <p className="text-paper-500 mt-1 text-sm">
                          {result.year ?? "Year unknown"} ·{" "}
                          {result.director ?? "Director unknown"}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
                <QuietButton
                  className="mt-5"
                  onClick={() => {
                    setManual(true);
                    setResults([]);
                  }}
                >
                  Enter manually
                </QuietButton>
              </div>
            ) : (
              <FilmFields
                selected={selected}
                manual={manual}
                genres={genres}
                franchiseNames={franchiseNames}
                onSubmit={submit}
                saving={saving}
                onBack={() => {
                  setSelected(null);
                  setManual(false);
                }}
              />
            )}
            {error ? (
              <p
                className="border-accent-400 text-paper-300 mt-5 border-l pl-3 text-sm"
                role="alert"
              >
                {error}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function FilmFields({
  selected,
  manual,
  genres,
  franchiseNames,
  onSubmit,
  saving,
  onBack,
}: {
  selected: TmdbMovieDetails | null;
  manual: boolean;
  genres: string[];
  franchiseNames: string[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
  onBack: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="mt-8">
      {selected ? (
        <div className="border-hairline mb-6 flex gap-4 border-y py-4">
          <div className="rounded-ui bg-ink-800 relative h-28 w-20 shrink-0 overflow-hidden">
            {selected.posterPath ? (
              <Image
                src={tmdbImage(selected.posterPath, "w185")!}
                alt=""
                fill
                sizes="80px"
                className="object-cover"
              />
            ) : null}
          </div>
          <div>
            <h3 className="text-paper-100 font-serif text-2xl">
              {selected.title}
            </h3>
            <p className="text-paper-500 mt-1 text-sm">
              {selected.year} · {selected.director ?? "Director unknown"} ·{" "}
              {selected.runtime ? `${selected.runtime} min` : "Runtime unknown"}
            </p>
            <p className="text-paper-300 mt-3 line-clamp-3 text-sm leading-6">
              {selected.overview}
            </p>
          </div>
        </div>
      ) : null}
      {manual || (selected && selected.year === null) ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {manual ? (
            <Field label="Title">
              <Input name="title" required />
            </Field>
          ) : null}
          <Field label="Release year">
            <Input
              name="releaseYear"
              type="number"
              min={1888}
              max={2200}
              required
            />
          </Field>
        </div>
      ) : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Status">
          <select name="status" className="select-field bg-ink-850">
            <option value="to_watch">To Watch</option>
            <option value="watched">Watched</option>
            <option value="to_rewatch">To Re-Watch</option>
          </select>
        </Field>
        <Field label="Watch order (optional)">
          <Input name="watchOrder" type="number" min={0} />
        </Field>
        <Field label="Primary genre">
          <Input name="genrePrimary" list="genre-options" />
        </Field>
        <Field label="Secondary genre">
          <Input name="genreSecondary" list="genre-options" />
        </Field>
        <Field label="Franchise">
          <Input
            name="franchiseName"
            list="franchise-options"
            placeholder="Choose or create"
          />
        </Field>
        <Field label="Sub-franchise">
          <Input name="subFranchiseName" placeholder="Create inline" />
        </Field>
        {manual ? (
          <>
            <Field label="Director (optional)">
              <Input name="director" />
            </Field>
            <Field label="Runtime in minutes (optional)">
              <Input name="runtime" type="number" min={1} max={1000} />
            </Field>
          </>
        ) : null}
      </div>
      <datalist id="genre-options">
        {genres.map((genre) => (
          <option key={genre} value={genre} />
        ))}
      </datalist>
      <datalist id="franchise-options">
        {franchiseNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      {manual ? (
        <Field label="Overview (optional)" className="mt-4">
          <textarea
            name="overview"
            rows={3}
            className="rounded-ui border-hairline bg-ink-850 text-paper-100 focus:border-accent-400 w-full border p-3 text-sm outline-none"
          />
        </Field>
      ) : null}
      <Field label="Notes" className="mt-4">
        <textarea
          name="notes"
          rows={3}
          className="rounded-ui border-hairline bg-ink-850 text-paper-100 focus:border-accent-400 w-full border p-3 text-sm outline-none"
        />
      </Field>
      <div className="mt-6 flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Adding…" : "Add to library"}
        </Button>
        <QuietButton type="button" onClick={onBack}>
          Back
        </QuietButton>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={`text-paper-500 block text-xs tracking-widest uppercase ${className}`}
    >
      {label}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}
