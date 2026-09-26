import { dateInTimeZone } from "./dates";
import type { TmdbMovieDetails } from "./tmdb";

type FilmStatus = "watched" | "to_watch";

export async function fetchTmdbDetails(tmdbId: number) {
  const response = await fetch(`/api/tmdb/movie/${tmdbId}`);
  const body = (await response.json()) as TmdbMovieDetails & { error?: string };
  if (!response.ok)
    throw new Error(body.error ?? "Could not load movie details.");
  return body;
}

/**
 * Adds a TMDB film to the library. Returns the library id and whether the film
 * was already there. A film added as watched also gets a watch logged today.
 */
export async function addTmdbFilm(
  details: TmdbMovieDetails,
  status: FilmStatus,
) {
  if (details.year === null)
    throw new Error(
      "This title has no release year, so it cannot be added yet.",
    );
  const response = await fetch("/api/films", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tmdbId: details.id,
      title: details.title,
      releaseYear: details.year,
      status,
      genrePrimary: details.genres[0] ?? null,
      genreSecondary: details.genres[1] ?? null,
      notes: "",
      posterPath: details.posterPath,
      backdropPath: details.backdropPath,
      runtime: details.runtime,
      director: details.director,
      overview: details.overview,
      tmdbGenres: details.genres,
    }),
  });
  const body = (await response.json()) as { id?: number; error?: string };
  if (response.status === 409 && body.id)
    return { id: body.id, alreadyInLibrary: true };
  if (!response.ok || !body.id)
    throw new Error(body.error ?? "Could not add this movie.");
  if (status === "watched") {
    await fetch(`/api/films/${body.id}/watches`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ watchedOn: dateInTimeZone(), isRewatch: false }),
    });
  }
  return { id: body.id, alreadyInLibrary: false };
}
