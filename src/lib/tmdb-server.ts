import {
  mapTmdbMovie,
  mapTmdbMoviePage,
  mapTmdbPeople,
  mapTmdbVideos,
  type TmdbMovieDetails,
  type TmdbMoviePage,
  type TmdbPersonResult,
  type TmdbSearchResult,
} from "./tmdb";

const API_BASE = "https://api.themoviedb.org/3";
const SEARCH_CACHE_MS = 15 * 60 * 1000;
const SIX_HOURS = 6 * 60 * 60;
const ONE_DAY = 24 * 60 * 60;
const searchCache = new Map<
  string,
  { expires: number; results: TmdbSearchResult[] }
>();

type CacheOptions = { revalidate: number; tags: string[] };

export type TmdbDiscoverOptions = {
  page?: number;
  sortBy?:
    | "popularity.desc"
    | "primary_release_date.desc"
    | "revenue.desc"
    | "vote_average.desc"
    | "vote_count.desc";
  voteCountGte?: number;
  voteAverageGte?: number;
  withGenres?: number[];
  withPeople?: number[];
  withCrew?: number[];
  withKeywords?: number[];
  releaseDateGte?: string;
  releaseDateLte?: string;
};

export class TmdbError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function request(
  path: string,
  params: Record<string, string> = {},
  cacheOptions?: CacheOptions,
) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) throw new TmdbError("TMDB_API_KEY is not configured.", 503);
  const url = new URL(`${API_BASE}${path}`);
  url.search = new URLSearchParams({
    api_key: apiKey,
    language: "en-US",
    ...params,
  }).toString();
  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(8_000),
      ...(cacheOptions
        ? {
            next: {
              revalidate: cacheOptions.revalidate,
              tags: cacheOptions.tags,
            },
          }
        : { cache: "no-store" as const }),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    )
      throw new TmdbError("TMDB took too long to respond. Try again.", 504);
    throw new TmdbError("TMDB is temporarily unavailable.", 502);
  }
  if (response.status === 429)
    throw new TmdbError("TMDB rate limit reached. Try again shortly.", 429);
  if (!response.ok)
    throw new TmdbError(
      response.status === 404 ? "Movie not found." : "TMDB request failed.",
      response.status,
    );
  return (await response.json()) as Record<string, unknown>;
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  limit: number,
  mapper: (value: T) => Promise<R>,
) {
  const results = new Array<R>(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(values[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, () => worker()),
  );
  return results;
}

export async function searchTmdb(query: string): Promise<TmdbSearchResult[]> {
  const key = query.trim().toLowerCase();
  const cached = searchCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.results;
  const payload = await request("/search/movie", {
    query,
    include_adult: "false",
    page: "1",
  });
  const rawResults = Array.isArray(payload.results)
    ? payload.results.slice(0, 8)
    : [];
  const results = await mapWithConcurrency(rawResults, 4, async (movie) => {
    if (!movie || typeof movie !== "object") return null;
    try {
      const id = String((movie as Record<string, unknown>).id);
      const details = await request(
        `/movie/${id}`,
        { append_to_response: "credits,keywords" },
        { revalidate: ONE_DAY, tags: [`tmdb-movie-${id}`] },
      );
      return mapTmdbMovie(details);
    } catch {
      return mapTmdbMovie(movie as Record<string, unknown>);
    }
  });
  const mapped = results.filter(
    (result): result is TmdbMovieDetails => result !== null,
  );
  searchCache.set(key, {
    expires: Date.now() + SEARCH_CACHE_MS,
    results: mapped,
  });
  return mapped;
}

export async function searchTmdbPerson(
  query: string,
): Promise<TmdbPersonResult[]> {
  return mapTmdbPeople(
    await request(
      "/search/person",
      { query, include_adult: "false", page: "1" },
      { revalidate: ONE_DAY, tags: ["tmdb-people"] },
    ),
  );
}

export async function getTmdbMovie(id: number) {
  return mapTmdbMovie(
    await request(
      `/movie/${id}`,
      { append_to_response: "credits,keywords" },
      { revalidate: ONE_DAY, tags: [`tmdb-movie-${id}`] },
    ),
  );
}

export async function getTmdbTrending(
  timeWindow: "day" | "week" = "week",
): Promise<TmdbMoviePage> {
  return mapTmdbMoviePage(
    await request(
      `/trending/movie/${timeWindow}`,
      {},
      { revalidate: SIX_HOURS, tags: [`tmdb-trending-${timeWindow}`] },
    ),
  );
}

export async function discoverTmdbMovies(
  options: TmdbDiscoverOptions = {},
): Promise<TmdbMoviePage> {
  const params: Record<string, string> = {
    include_adult: "false",
    include_video: "false",
    page: String(options.page ?? 1),
    sort_by: options.sortBy ?? "vote_average.desc",
  };
  if (options.voteCountGte != null)
    params["vote_count.gte"] = String(options.voteCountGte);
  if (options.voteAverageGte != null)
    params["vote_average.gte"] = String(options.voteAverageGte);
  if (options.withGenres?.length)
    params.with_genres = options.withGenres.join(",");
  if (options.withPeople?.length)
    params.with_people = options.withPeople.join(",");
  if (options.withCrew?.length)
    params.with_crew = options.withCrew.join(",");
  if (options.withKeywords?.length)
    params.with_keywords = options.withKeywords.join(",");
  if (options.releaseDateGte)
    params["primary_release_date.gte"] = options.releaseDateGte;
  if (options.releaseDateLte)
    params["primary_release_date.lte"] = options.releaseDateLte;
  return mapTmdbMoviePage(
    await request("/discover/movie", params, {
      revalidate: ONE_DAY,
      tags: ["tmdb-discover"],
    }),
  );
}

export async function getTmdbRecommendations(
  id: number,
  page = 1,
): Promise<TmdbMoviePage> {
  return mapTmdbMoviePage(
    await request(
      `/movie/${id}/recommendations`,
      { page: String(page) },
      { revalidate: ONE_DAY, tags: [`tmdb-recommendations-${id}`] },
    ),
  );
}

export async function getTmdbSimilar(
  id: number,
  page = 1,
): Promise<TmdbMoviePage> {
  return mapTmdbMoviePage(
    await request(
      `/movie/${id}/similar`,
      { page: String(page) },
      { revalidate: ONE_DAY, tags: [`tmdb-similar-${id}`] },
    ),
  );
}

export async function getTmdbVideos(id: number) {
  return mapTmdbVideos(
    await request(
      `/movie/${id}/videos`,
      {},
      { revalidate: ONE_DAY, tags: [`tmdb-videos-${id}`] },
    ),
  );
}
