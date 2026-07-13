import {
  mapTmdbMovie,
  type TmdbMovieDetails,
  type TmdbSearchResult,
} from "./tmdb";

const API_BASE = "https://api.themoviedb.org/3";
const CACHE_MS = 15 * 60 * 1000;
const searchCache = new Map<
  string,
  { expires: number; results: TmdbSearchResult[] }
>();

export class TmdbError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function request(path: string, params: Record<string, string> = {}) {
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
      cache: "no-store",
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
  const results = await Promise.all(
    rawResults.map(async (movie) => {
      if (!movie || typeof movie !== "object") return null;
      try {
        const details = await request(
          `/movie/${String((movie as Record<string, unknown>).id)}`,
          {
            append_to_response: "credits",
          },
        );
        return mapTmdbMovie(details);
      } catch {
        return mapTmdbMovie(movie as Record<string, unknown>);
      }
    }),
  );
  const mapped = results.filter(
    (result): result is TmdbMovieDetails => result !== null,
  );
  searchCache.set(key, { expires: Date.now() + CACHE_MS, results: mapped });
  return mapped;
}

export async function getTmdbMovie(id: number) {
  return mapTmdbMovie(
    await request(`/movie/${id}`, { append_to_response: "credits" }),
  );
}
