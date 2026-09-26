"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useFilmActions } from "@/components/film-actions-provider";
import { jumpPages } from "@/components/nav-items";
import { SearchIcon } from "@/components/ui/icons";
import { addTmdbFilm, fetchTmdbDetails } from "@/lib/add-film-client";
import { tmdbImage, type TmdbSearchResult } from "@/lib/tmdb";

type PaletteMode = "jump" | "rate";

type LibraryResult = {
  id: number;
  title: string;
  releaseYear: number;
  posterPath: string | null;
};

type Choice =
  | { kind: "page"; label: string; href: string }
  | { kind: "library"; item: LibraryResult }
  | { kind: "tmdb"; item: TmdbSearchResult };

type PaletteActions = { openPalette: (mode: PaletteMode) => void };

const PaletteContext = createContext<PaletteActions | null>(null);

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<PaletteMode | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const openPalette = useCallback((nextMode: PaletteMode) => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    setMode(nextMode);
  }, []);

  const close = useCallback(() => {
    setMode(null);
    window.requestAnimationFrame(() => returnFocusRef.current?.focus());
  }, []);

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key.toLowerCase() !== "k" || !(event.ctrlKey || event.metaKey))
        return;
      event.preventDefault();
      setMode((current) => {
        if (current) return null;
        returnFocusRef.current = document.activeElement as HTMLElement | null;
        return "jump";
      });
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <PaletteContext.Provider value={{ openPalette }}>
      {children}
      {mode ? <Palette key={mode} mode={mode} onClose={close} /> : null}
    </PaletteContext.Provider>
  );
}

export function useCommandPalette() {
  const actions = useContext(PaletteContext);
  if (!actions)
    throw new Error(
      "useCommandPalette must be used inside CommandPaletteProvider",
    );
  return actions;
}

function Palette({
  mode,
  onClose,
}: {
  mode: PaletteMode;
  onClose: () => void;
}) {
  const router = useRouter();
  const { openTmdbMovie } = useFilmActions();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{
    library: LibraryResult[];
    tmdb: TmdbSearchResult[];
  }>({ library: [], tmdb: [] });
  const [searching, setSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Search failed");
        setResults(await response.json());
        setActiveIndex(0);
      } catch {
        if (!controller.signal.aborted) setResults({ library: [], tmdb: [] });
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  const pages = useMemo(() => {
    if (mode === "rate") return [];
    const needle = trimmed.toLowerCase();
    return jumpPages.filter(
      ({ label, keywords }) =>
        !needle || `${label} ${keywords}`.toLowerCase().includes(needle),
    );
  }, [mode, trimmed]);

  const searched = trimmed.length >= 2;
  const choices: Choice[] = useMemo(
    () => [
      ...pages.map((page) => ({ kind: "page" as const, ...page })),
      ...(searched
        ? [
            ...results.library.map((item) => ({
              kind: "library" as const,
              item,
            })),
            ...results.tmdb.map((item) => ({ kind: "tmdb" as const, item })),
          ]
        : []),
    ],
    [pages, results, searched],
  );

  async function choose(choice: Choice | undefined) {
    if (!choice || busy) return;
    if (choice.kind === "page") {
      onClose();
      router.push(choice.href);
      return;
    }
    if (choice.kind === "library") {
      onClose();
      router.push(
        `/films/${choice.item.id}${mode === "rate" ? "?rate=1#rate" : ""}`,
      );
      return;
    }
    if (mode === "jump") {
      onClose();
      openTmdbMovie({ tmdbId: choice.item.id, title: choice.item.title });
      return;
    }
    setBusy(choice.item.title);
    setError("");
    try {
      const details = await fetchTmdbDetails(choice.item.id);
      const { id } = await addTmdbFilm(details, "watched");
      onClose();
      router.push(`/films/${id}?rate=1#rate`);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not add this movie.",
      );
      setBusy("");
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown" && choices.length) {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % choices.length);
    } else if (event.key === "ArrowUp" && choices.length) {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + choices.length) % choices.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      void choose(choices[activeIndex]);
    }
  }

  const title = mode === "rate" ? "Rate a film" : "Search or jump";
  let offset = 0;
  const pageStart = offset;
  offset += pages.length;
  const libraryStart = offset;
  offset += searched ? results.library.length : 0;
  const tmdbStart = offset;

  return (
    <div
      className="bg-ink-950/85 fixed inset-0 z-[110] overflow-y-auto px-4 pt-[10vh] pb-8 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="border-ink-800 bg-ink-900 rounded-card mx-auto w-full max-w-xl overflow-hidden border shadow-2xl"
      >
        <div className="border-hairline flex items-center gap-3 border-b px-4">
          <SearchIcon className="text-paper-500 h-5 w-5 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
              if (event.target.value.trim().length < 2) {
                setResults({ library: [], tmdb: [] });
                setSearching(false);
              }
            }}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={
              choices[activeIndex] ? `palette-choice-${activeIndex}` : undefined
            }
            aria-label={title}
            autoComplete="off"
            placeholder={
              mode === "rate"
                ? "Find a film in your library or on TMDB"
                : "Search films or jump to a page"
            }
            className="text-paper-100 placeholder:text-paper-500 h-14 min-w-0 flex-1 bg-transparent text-base outline-none focus-visible:outline-none"
          />
          <kbd className="border-hairline text-paper-500 rounded border px-1.5 py-0.5 font-mono text-[11px]">
            Esc
          </kbd>
        </div>

        <div
          id="palette-results"
          role="listbox"
          aria-label="Results"
          className="max-h-[60vh] overflow-y-auto p-2"
        >
          {mode === "rate" && !searched ? (
            <p className="text-paper-500 px-3 py-6 text-sm">
              Type at least two letters. Pick a film from your library to rate
              it. Pick a TMDB film to add it as watched today, then rate it.
            </p>
          ) : null}

          {pages.length ? (
            <Group title="Pages">
              {pages.map((page, index) => (
                <Option
                  key={page.href}
                  index={pageStart + index}
                  active={activeIndex === pageStart + index}
                  onHover={setActiveIndex}
                  onChoose={() => choose(choices[pageStart + index])}
                >
                  <span className="text-paper-100">{page.label}</span>
                </Option>
              ))}
            </Group>
          ) : null}

          {searched && results.library.length ? (
            <Group title="In your library">
              {results.library.map((item, index) => (
                <Option
                  key={item.id}
                  index={libraryStart + index}
                  active={activeIndex === libraryStart + index}
                  onHover={setActiveIndex}
                  onChoose={() => choose(choices[libraryStart + index])}
                >
                  <FilmResult
                    title={item.title}
                    detail={String(item.releaseYear)}
                    posterPath={item.posterPath}
                  />
                </Option>
              ))}
            </Group>
          ) : null}

          {searched && results.tmdb.length ? (
            <Group
              title={mode === "rate" ? "On TMDB · adds as watched" : "On TMDB"}
            >
              {results.tmdb.map((item, index) => (
                <Option
                  key={item.id}
                  index={tmdbStart + index}
                  active={activeIndex === tmdbStart + index}
                  onHover={setActiveIndex}
                  onChoose={() => choose(choices[tmdbStart + index])}
                >
                  <FilmResult
                    title={item.title}
                    detail={[item.year ?? "Year unknown", item.director]
                      .filter(Boolean)
                      .join(" · ")}
                    posterPath={item.posterPath}
                  />
                </Option>
              ))}
            </Group>
          ) : null}

          {searched && searching ? (
            <p className="text-paper-500 px-3 py-4 text-sm">Searching…</p>
          ) : null}
          {searched && !searching && !choices.length ? (
            <p className="text-paper-500 px-3 py-4 text-sm">
              No matching films or pages.
            </p>
          ) : null}
          {busy ? (
            <p className="text-paper-300 px-3 py-4 text-sm" role="status">
              Adding {busy} to your library…
            </p>
          ) : null}
          {error ? (
            <p className="text-accent-300 px-3 py-4 text-sm" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="py-1">
      <p className="text-paper-500 px-3 pt-2 pb-1 text-[11px] font-semibold tracking-[0.12em] uppercase">
        {title}
      </p>
      {children}
    </div>
  );
}

function Option({
  index,
  active,
  onHover,
  onChoose,
  children,
}: {
  index: number;
  active: boolean;
  onHover: (index: number) => void;
  onChoose: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="option"
      id={`palette-choice-${index}`}
      aria-selected={active}
      tabIndex={-1}
      onMouseEnter={() => onHover(index)}
      onClick={onChoose}
      className={`rounded-ui flex w-full items-center gap-3 px-3 py-2 text-left text-sm ${active ? "bg-ink-850" : ""}`}
    >
      {children}
    </button>
  );
}

function FilmResult({
  title,
  detail,
  posterPath,
}: {
  title: string;
  detail: string;
  posterPath: string | null;
}) {
  return (
    <>
      <span className="bg-ink-800 relative h-12 w-8 shrink-0 overflow-hidden rounded">
        {posterPath ? (
          <Image
            src={tmdbImage(posterPath, "w185")!}
            alt=""
            fill
            sizes="32px"
            className="object-cover"
          />
        ) : null}
      </span>
      <span className="grid min-w-0">
        <span className="text-paper-100 truncate font-medium">{title}</span>
        <span className="text-paper-500 text-xs">{detail}</span>
      </span>
    </>
  );
}
