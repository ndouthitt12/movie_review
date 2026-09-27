"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button, QuietButton } from "@/components/button";
import { addTmdbFilm } from "@/lib/add-film-client";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { loginHref, useIsOwner } from "@/lib/use-is-owner";
import { tmdbImage, type TmdbMovieDetails } from "@/lib/tmdb";

type AddTarget = { tmdbId: number; title: string };
type FilmActions = { openTmdbMovie: (target: AddTarget) => void };

const FilmActionsContext = createContext<FilmActions | null>(null);

export function FilmActionsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const owner = useIsOwner();
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [target, setTarget] = useState<AddTarget | null>(null);
  const [details, setDetails] = useState<TmdbMovieDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [libraryFilmId, setLibraryFilmId] = useState<number | null>(null);
  useBodyScrollLock(target !== null);

  const close = useCallback(() => {
    setTarget(null);
    setDetails(null);
    setLoading(false);
    setError("");
    setLibraryFilmId(null);
    window.requestAnimationFrame(() => returnFocusRef.current?.focus());
  }, []);

  const openTmdbMovie = useCallback((nextTarget: AddTarget) => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    setTarget(nextTarget);
    setDetails(null);
    setLibraryFilmId(null);
    setError("");
    setLoading(true);
  }, []);

  useEffect(() => {
    if (!target) return;
    const controller = new AbortController();
    void fetch(`/api/tmdb/movie/${target.tmdbId}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as TmdbMovieDetails & {
          error?: string;
        };
        if (!response.ok)
          throw new Error(body.error ?? "Could not load movie details.");
        setDetails(body);
      })
      .catch((caught) => {
        if (!controller.signal.aborted)
          setError(
            caught instanceof Error
              ? caught.message
              : "Could not load movie details.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [target]);

  useEffect(() => {
    if (!target) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [
        ...dialogRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), a[href]",
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
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close, target]);

  async function addToWatchlist() {
    if (!details) return;
    setSaving(true);
    setError("");
    try {
      const { id, alreadyInLibrary } = await addTmdbFilm(details, "to_watch");
      setLibraryFilmId(id);
      if (alreadyInLibrary) setError("This movie is already in your library.");
      else router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not add this movie.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function rateNow() {
    if (!details) return;
    setSaving(true);
    setError("");
    try {
      const { id } = await addTmdbFilm(details, "watched");
      close();
      router.push(`/films/${id}?rate=1#rate`);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not add this movie.",
      );
      setSaving(false);
    }
  }

  return (
    <FilmActionsContext.Provider value={{ openTmdbMovie }}>
      {children}
      {target ? (
        <div
          className="bg-ink-950/92 fixed inset-0 z-[100] flex overflow-y-auto overscroll-contain p-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-add-title"
          ref={dialogRef}
        >
          {/* m-auto centres the card, but a card taller than the screen
              starts at the top, so its Close button stays reachable. */}
          <div className="rounded-card border-hairline bg-ink-900 m-auto w-full max-w-xl border p-5 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="type-label text-accent-400 tracking-[0.18em] uppercase">
                  {owner ? "Add to your library" : "On TMDB"}
                </p>
                <h2
                  id="quick-add-title"
                  className="type-page-heading text-paper-100 mt-2"
                >
                  {details?.title ?? target.title}
                </h2>
              </div>
              <QuietButton autoFocus onClick={close} aria-label="Close dialog">
                Close
              </QuietButton>
            </div>
            {loading ? (
              <p className="text-paper-500 mt-8 text-sm">Loading details…</p>
            ) : details ? (
              <div className="mt-7 flex gap-5">
                <div className="bg-ink-800 relative h-40 w-28 shrink-0 overflow-hidden rounded-lg">
                  {details.posterPath ? (
                    <Image
                      src={tmdbImage(details.posterPath, "w185")!}
                      alt=""
                      fill
                      sizes="112px"
                      className="object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="text-paper-300 text-sm">
                    {[
                      details.year,
                      details.director,
                      details.genres.slice(0, 2).join(", "),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="text-paper-300 mt-4 line-clamp-4 text-sm leading-6">
                    {details.overview || "No overview is available."}
                  </p>
                </div>
              </div>
            ) : null}
            {error ? (
              <p
                className="border-accent-400 text-paper-300 mt-5 border-l pl-3 text-sm"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            <div className="mt-7 flex flex-wrap gap-3">
              {libraryFilmId ? (
                <Link
                  href={`/films/${libraryFilmId}`}
                  className="bg-accent-400 text-ink-950 inline-flex min-h-10 items-center rounded-lg px-4 text-sm font-semibold"
                >
                  Open in library
                </Link>
              ) : !owner ? (
                <Link
                  href={loginHref(pathname)}
                  className="bg-accent-400 text-ink-950 inline-flex min-h-10 items-center rounded-lg px-4 text-sm font-semibold"
                >
                  Log in to add this film
                </Link>
              ) : (
                <>
                  <Button
                    onClick={addToWatchlist}
                    disabled={!details || loading || saving}
                  >
                    {saving ? "Adding…" : "Add to watchlist"}
                  </Button>
                  <button
                    type="button"
                    onClick={rateNow}
                    disabled={!details || loading || saving}
                    className="border-hairline text-paper-100 hover:border-accent-400 inline-flex min-h-10 items-center rounded-lg border px-4 text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    I watched it · rate now
                  </button>
                </>
              )}
              <a
                href={`https://www.themoviedb.org/movie/${target.tmdbId}`}
                target="_blank"
                rel="noreferrer"
                className="border-hairline text-paper-300 hover:border-accent-400 hover:text-paper-100 inline-flex min-h-10 items-center rounded-lg border px-4 text-sm transition-colors"
              >
                View on TMDB
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </FilmActionsContext.Provider>
  );
}

export function useFilmActions() {
  const actions = useContext(FilmActionsContext);
  if (!actions)
    throw new Error("useFilmActions must be used inside FilmActionsProvider");
  return actions;
}
