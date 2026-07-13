export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export interface TmdbSearchResult {
  id: number;
  title: string;
  year: number | null;
  director: string | null;
  posterPath: string | null;
  overview: string;
}

export interface TmdbMovieDetails extends TmdbSearchResult {
  backdropPath: string | null;
  runtime: number | null;
  genres: string[];
}

type CrewMember = { job?: string; name?: string };

export function mapTmdbMovie(
  movie: Record<string, unknown>,
  crew: CrewMember[] = [],
): TmdbMovieDetails {
  const releaseDate =
    typeof movie.release_date === "string" ? movie.release_date : "";
  const year = /^\d{4}/.test(releaseDate)
    ? Number(releaseDate.slice(0, 4))
    : null;
  const embeddedCrew =
    movie.credits &&
    typeof movie.credits === "object" &&
    "crew" in movie.credits
      ? ((movie.credits as { crew?: CrewMember[] }).crew ?? [])
      : crew;
  return {
    id: Number(movie.id),
    title: String(movie.title ?? "Untitled"),
    year,
    director: embeddedCrew.find(({ job }) => job === "Director")?.name ?? null,
    posterPath:
      typeof movie.poster_path === "string" ? movie.poster_path : null,
    backdropPath:
      typeof movie.backdrop_path === "string" ? movie.backdrop_path : null,
    overview: typeof movie.overview === "string" ? movie.overview : "",
    runtime: typeof movie.runtime === "number" ? movie.runtime : null,
    genres: Array.isArray(movie.genres)
      ? movie.genres
          .map((genre) =>
            genre && typeof genre === "object" && "name" in genre
              ? String(genre.name)
              : "",
          )
          .filter(Boolean)
      : [],
  };
}

export function tmdbImage(
  path: string | null,
  size: "w185" | "w342" | "w500" | "original",
) {
  return path ? `${TMDB_IMAGE_BASE}/${size}${path}` : null;
}
