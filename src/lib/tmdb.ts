export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export const TMDB_GENRE_IDS = {
  Action: 28,
  Adventure: 12,
  Animation: 16,
  Comedy: 35,
  Crime: 80,
  Documentary: 99,
  Drama: 18,
  Family: 10751,
  Fantasy: 14,
  History: 36,
  Horror: 27,
  Music: 10402,
  Mystery: 9648,
  Romance: 10749,
  "Science Fiction": 878,
  "TV Movie": 10770,
  Thriller: 53,
  War: 10752,
  Western: 37,
} as const;

const GENRE_NAMES = new Map<number, string>(
  Object.entries(TMDB_GENRE_IDS).map(([name, id]) => [id, name]),
);

export interface TmdbSearchResult {
  id: number;
  title: string;
  year: number | null;
  director: string | null;
  posterPath: string | null;
  overview: string;
}

export interface TmdbMovieSummary {
  id: number;
  title: string;
  year: number | null;
  releaseDate: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string;
  adult: boolean;
  popularity: number;
  voteAverage: number;
  voteCount: number;
  genreIds: number[];
  genres: string[];
}

export interface TmdbMovieDetails extends TmdbMovieSummary {
  director: string | null;
  runtime: number | null;
  keywords: string[];
  cast: string[];
  collectionId: number | null;
}

export interface TmdbMoviePage {
  page: number;
  totalPages: number;
  totalResults: number;
  results: TmdbMovieSummary[];
}

export interface TmdbVideo {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
  publishedAt: string | null;
}

export interface TmdbPersonResult {
  id: number;
  name: string;
  knownForDepartment: string | null;
  profilePath: string | null;
}

type CrewMember = { job?: string; name?: string };

function finiteNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function releaseDate(movie: Record<string, unknown>) {
  return typeof movie.release_date === "string" && movie.release_date
    ? movie.release_date
    : null;
}

function releaseYear(date: string | null) {
  return date && /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null;
}

function genreData(movie: Record<string, unknown>) {
  const embedded = Array.isArray(movie.genres)
    ? movie.genres.filter(
        (genre): genre is Record<string, unknown> =>
          Boolean(genre) && typeof genre === "object",
      )
    : [];
  const genreIds = embedded.length
    ? embedded
        .map(({ id }) => finiteNumber(id, Number.NaN))
        .filter(Number.isFinite)
    : Array.isArray(movie.genre_ids)
      ? movie.genre_ids
          .map((id) => finiteNumber(id, Number.NaN))
          .filter(Number.isFinite)
      : [];
  const names = embedded.length
    ? embedded
        .map(({ name }) => (typeof name === "string" ? name : ""))
        .filter(Boolean)
    : genreIds
        .map((id) => GENRE_NAMES.get(id) ?? "")
        .filter(Boolean);
  return { genreIds, genres: names };
}

export function tmdbGenreId(name: string) {
  const normalized = name === "Sci-Fi" ? "Science Fiction" : name;
  return TMDB_GENRE_IDS[normalized as keyof typeof TMDB_GENRE_IDS] ?? null;
}

export function mapTmdbMovieSummary(
  movie: Record<string, unknown>,
): TmdbMovieSummary {
  const date = releaseDate(movie);
  return {
    id: finiteNumber(movie.id),
    title: String(movie.title ?? "Untitled"),
    year: releaseYear(date),
    releaseDate: date,
    posterPath:
      typeof movie.poster_path === "string" ? movie.poster_path : null,
    backdropPath:
      typeof movie.backdrop_path === "string" ? movie.backdrop_path : null,
    overview: typeof movie.overview === "string" ? movie.overview : "",
    adult: movie.adult === true,
    popularity: finiteNumber(movie.popularity),
    voteAverage: finiteNumber(movie.vote_average),
    voteCount: finiteNumber(movie.vote_count),
    ...genreData(movie),
  };
}

export function mapTmdbMovie(
  movie: Record<string, unknown>,
  crew: CrewMember[] = [],
): TmdbMovieDetails {
  const credits =
    movie.credits && typeof movie.credits === "object"
      ? (movie.credits as Record<string, unknown>)
      : {};
  const embeddedCrew = Array.isArray(credits.crew)
    ? (credits.crew as CrewMember[])
    : crew;
  const embeddedCast = Array.isArray(credits.cast)
    ? credits.cast
        .map((member) =>
          member && typeof member === "object" && "name" in member
            ? String(member.name)
            : "",
        )
        .filter(Boolean)
        .slice(0, 10)
    : [];
  const keywordPayload =
    movie.keywords && typeof movie.keywords === "object"
      ? (movie.keywords as Record<string, unknown>)
      : {};
  const rawKeywords = Array.isArray(keywordPayload.keywords)
    ? keywordPayload.keywords
    : Array.isArray(keywordPayload.results)
      ? keywordPayload.results
      : [];
  const collection =
    movie.belongs_to_collection && typeof movie.belongs_to_collection === "object"
      ? (movie.belongs_to_collection as Record<string, unknown>)
      : null;
  return {
    ...mapTmdbMovieSummary(movie),
    director:
      embeddedCrew.find(({ job }) => job === "Director")?.name ?? null,
    runtime: typeof movie.runtime === "number" ? movie.runtime : null,
    keywords: rawKeywords
      .map((keyword) =>
        keyword && typeof keyword === "object" && "name" in keyword
          ? String(keyword.name)
          : "",
      )
      .filter(Boolean),
    cast: embeddedCast,
    collectionId:
      collection && typeof collection.id === "number" ? collection.id : null,
  };
}

export function mapTmdbMoviePage(
  payload: Record<string, unknown>,
): TmdbMoviePage {
  return {
    page: finiteNumber(payload.page, 1),
    totalPages: finiteNumber(payload.total_pages, 1),
    totalResults: finiteNumber(payload.total_results),
    results: Array.isArray(payload.results)
      ? payload.results
          .filter(
            (movie): movie is Record<string, unknown> =>
              Boolean(movie) && typeof movie === "object",
          )
          .map(mapTmdbMovieSummary)
      : [],
  };
}

export function mapTmdbVideos(payload: Record<string, unknown>): TmdbVideo[] {
  if (!Array.isArray(payload.results)) return [];
  return payload.results
    .filter(
      (video): video is Record<string, unknown> =>
        Boolean(video) && typeof video === "object",
    )
    .map((video) => ({
      id: String(video.id ?? ""),
      key: String(video.key ?? ""),
      name: String(video.name ?? "Trailer"),
      site: String(video.site ?? ""),
      type: String(video.type ?? ""),
      official: video.official === true,
      publishedAt:
        typeof video.published_at === "string" ? video.published_at : null,
    }))
    .filter(({ id, key }) => Boolean(id && key));
}

export function selectTmdbTrailer(videos: readonly TmdbVideo[]) {
  return [...videos]
    .filter(({ site }) => site.toLowerCase() === "youtube")
    .sort(
      (left, right) =>
        Number(right.official) - Number(left.official) ||
        Number(right.type === "Trailer") - Number(left.type === "Trailer") ||
        (right.publishedAt ?? "").localeCompare(left.publishedAt ?? "") ||
        left.id.localeCompare(right.id),
    )[0] ?? null;
}

export function mapTmdbPeople(
  payload: Record<string, unknown>,
): TmdbPersonResult[] {
  if (!Array.isArray(payload.results)) return [];
  return payload.results
    .filter(
      (person): person is Record<string, unknown> =>
        Boolean(person) && typeof person === "object",
    )
    .map((person) => ({
      id: finiteNumber(person.id),
      name: String(person.name ?? ""),
      knownForDepartment:
        typeof person.known_for_department === "string"
          ? person.known_for_department
          : null,
      profilePath:
        typeof person.profile_path === "string" ? person.profile_path : null,
    }))
    .filter(({ id, name }) => id > 0 && Boolean(name));
}

export function tmdbImage(
  path: string | null,
  size: "w185" | "w342" | "w500" | "original",
) {
  return path ? `${TMDB_IMAGE_BASE}/${size}${path}` : null;
}
