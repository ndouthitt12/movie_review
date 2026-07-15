import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";
import { getLibraryFilms, type LibraryFilm } from "./catalog";
import { RECOMMENDATIONS_CACHE_TAG } from "./recs-cache";
import type {
  RecommendationCandidate,
  RecommendationSeed,
} from "./recs/candidate-score";
import {
  recommendMovies,
  type RecommendationLibraryIndex,
  type RecommendationResult,
} from "./recs/recommend";
import {
  buildTasteProfile,
  isNeutralTasteProfile,
  neutralTasteProfile,
  recencyWeight,
  type TasteProfile,
} from "./recs/taste-profile";
import {
  discoverTmdbMovies,
  getTmdbMovie,
  getTmdbRecommendations,
  getTmdbSimilar,
  getTmdbTrending,
  searchTmdbPerson,
} from "./tmdb-server";
import { tmdbGenreId, type TmdbMovieSummary } from "./tmdb";

const MAX_CANDIDATES = 250;
const MAX_ENRICHED_CANDIDATES = 60;

export type RecommendationPayload = RecommendationResult & {
  available: boolean;
  generatedAt: string;
  error?: string;
};

export type RawTrendingPayload = {
  available: boolean;
  generatedAt: string;
  items: TmdbMovieSummary[];
  error?: string;
};

const getCachedRecommendations = unstable_cache(
  buildRecommendationPayload,
  ["recommendations-v1"],
  { revalidate: 21_600, tags: [RECOMMENDATIONS_CACHE_TAG] },
);

const getCachedRawTrending = unstable_cache(
  buildRawTrendingPayload,
  ["recommendations-trending-v1"],
  { revalidate: 21_600, tags: [RECOMMENDATIONS_CACHE_TAG] },
);

const getRecommendationPayload = cache(() => getCachedRecommendations());
const getRawTrendingPayload = cache(() => getCachedRawTrending());

export async function getRecommendations(limit = 20) {
  const payload = await getRecommendationPayload();
  return { ...payload, items: payload.items.slice(0, clampLimit(limit)) };
}

export async function getRawTrending(limit = 100) {
  const payload = await getRawTrendingPayload();
  return { ...payload, items: payload.items.slice(0, clampLimit(limit)) };
}

async function buildRecommendationPayload(): Promise<RecommendationPayload> {
  const generatedAt = new Date().toISOString();
  let films: LibraryFilm[];
  try {
    films = await getLibraryFilms();
  } catch {
    return unavailableRecommendations(
      generatedAt,
      "The library could not be loaded.",
    );
  }
  let profile: TasteProfile;
  try {
    profile = buildTasteProfile(films);
  } catch {
    profile = neutralTasteProfile();
  }
  const libraryIndex = makeLibraryIndex(films);
  try {
    const trending = (await getTmdbTrending("week")).results;
    if (isNeutralTasteProfile(profile)) {
      return {
        available: true,
        generatedAt,
        ...recommendMovies({
          candidates: [],
          trending,
          profile,
          libraryIndex,
          limit: 100,
        }),
      };
    }
    const candidates = await gatherCandidates(films, profile);
    return {
      available: true,
      generatedAt,
      ...recommendMovies({
        candidates,
        trending,
        profile,
        libraryIndex,
        limit: 100,
      }),
    };
  } catch {
    return unavailableRecommendations(
      generatedAt,
      "TMDB recommendations are temporarily unavailable.",
    );
  }
}

async function buildRawTrendingPayload(): Promise<RawTrendingPayload> {
  const generatedAt = new Date().toISOString();
  try {
    return {
      available: true,
      generatedAt,
      items: (await getTmdbTrending("week")).results,
    };
  } catch {
    return {
      available: false,
      generatedAt,
      items: [],
      error: "TMDB trending is temporarily unavailable.",
    };
  }
}

async function gatherCandidates(
  films: readonly LibraryFilm[],
  profile: TasteProfile,
) {
  const byId = new Map<number, RecommendationCandidate>();
  for (const film of films) {
    if (film.status === "to_watch" && film.tmdbId !== null)
      upsertCandidate(byId, libraryCandidate(film));
  }

  const seeds = topSeeds(films, profile);
  const seedTasks = seeds.flatMap((seed) => [
    async () => ({
      movies: (await getTmdbRecommendations(seed.tmdbId)).results,
      seed,
    }),
    async () => ({
      movies: (await getTmdbSimilar(seed.tmdbId)).results,
      seed,
    }),
  ]);
  const seedPages = await settleWithConcurrency(seedTasks, 4);
  for (const page of seedPages)
    for (const movie of page.movies)
      upsertCandidate(byId, summaryCandidate(movie, page.seed));

  const genres = Object.entries(profile.genreAffinity)
    .filter(([, affinity]) => affinity > 0)
    .sort(
      ([leftName, left], [rightName, right]) =>
        right - left || leftName.localeCompare(rightName),
    )
    .map(([name]) => ({ name, id: tmdbGenreId(name) }))
    .flatMap((genre) => (genre.id === null ? [] : [genre]))
    .slice(0, 3);
  const genrePages = await settleWithConcurrency(
    genres.map(
      ({ id }) => async () =>
        discoverTmdbMovies({ withGenres: [id], voteCountGte: 200 }),
    ),
    4,
  );
  for (const page of genrePages)
    for (const movie of page.results)
      upsertCandidate(byId, summaryCandidate(movie));

  const directorNames = Object.entries(profile.directorAffinity)
    .filter(([, affinity]) => affinity > 0)
    .sort(
      ([leftName, left], [rightName, right]) =>
        right - left || leftName.localeCompare(rightName),
    )
    .map(([name]) => name)
    .slice(0, 3);
  const directors = await settleWithConcurrency(
    directorNames.map(
      (name) => async () => {
        const people = await searchTmdbPerson(name);
        const exact = people.find(
          (person) =>
            person.name.toLowerCase() === name.toLowerCase() &&
            person.knownForDepartment === "Directing",
        );
        return exact ? { name, id: exact.id } : null;
      },
    ),
    4,
  );
  const directorPages = await settleWithConcurrency(
    directors
      .filter(
        (director): director is { name: string; id: number } =>
          director !== null,
      )
      .map(
        (director) => async () => ({
          director,
          page: await discoverTmdbMovies({
            withCrew: [director.id],
            voteCountGte: 200,
          }),
        }),
      ),
    4,
  );
  for (const { director, page } of directorPages)
    for (const movie of page.results)
      upsertCandidate(byId, {
        ...summaryCandidate(movie),
        director: director.name,
      });

  const candidates = [...byId.values()].slice(0, MAX_CANDIDATES);
  const enrichIds = new Set(
    [...candidates]
      .sort(
        (left, right) =>
          Number(right.isWatchlist) - Number(left.isWatchlist) ||
          right.voteCount - left.voteCount ||
          right.popularity - left.popularity ||
          left.tmdbId - right.tmdbId,
      )
      .slice(0, MAX_ENRICHED_CANDIDATES)
      .map(({ tmdbId }) => tmdbId),
  );
  const details = await settleWithConcurrency(
    candidates
      .filter(({ tmdbId }) => enrichIds.has(tmdbId))
      .map((candidate) => async () => ({
        candidate,
        details: await getTmdbMovie(candidate.tmdbId),
      })),
    4,
  );
  for (const { candidate, details: movie } of details)
    byId.set(candidate.tmdbId, {
      ...candidate,
      title: movie.title,
      year: movie.year,
      releaseDate: movie.releaseDate,
      posterPath: movie.posterPath,
      backdropPath: movie.backdropPath,
      overview: movie.overview,
      adult: movie.adult,
      popularity: movie.popularity,
      voteAverage: movie.voteAverage,
      voteCount: movie.voteCount,
      genres: movie.genres,
      director: movie.director ?? candidate.director,
    });
  return candidates.map((candidate) => byId.get(candidate.tmdbId) ?? candidate);
}

function topSeeds(films: readonly LibraryFilm[], profile: TasteProfile) {
  const rated = films.filter(
    (film): film is LibraryFilm & { overall: number; tmdbId: number } =>
      film.overall !== null && film.tmdbId !== null,
  );
  const maximumDeviation = Math.max(
    1,
    ...rated.map(({ overall }) => Math.abs(overall - profile.meanScore)),
  );
  const now = new Date();
  return rated
    .map((film) => ({
      tmdbId: film.tmdbId,
      title: film.title,
      displayRating: Math.max(0, Math.min(5, film.overall / 2)),
      score: Math.max(
        -1,
        Math.min(1, (film.overall - profile.meanScore) / maximumDeviation),
      ),
      rankScore:
        (film.overall - profile.meanScore) *
        recencyWeight(film.lastWatchDate, now),
    }))
    .filter(({ score }) => score > 0)
    .sort(
      (left, right) =>
        right.rankScore - left.rankScore || left.tmdbId - right.tmdbId,
    )
    .slice(0, 10)
    .map(({ tmdbId, title, displayRating, score }) => ({
      tmdbId,
      title,
      displayRating,
      score,
    }));
}

function makeLibraryIndex(films: readonly LibraryFilm[]) {
  return Object.fromEntries(
    films
      .filter(({ tmdbId }) => tmdbId !== null)
      .map((film) => [
        film.tmdbId as number,
        { filmId: film.id, status: film.status, overall: film.overall },
      ]),
  ) as RecommendationLibraryIndex;
}

function summaryCandidate(
  movie: TmdbMovieSummary,
  seed?: RecommendationSeed,
): RecommendationCandidate {
  return {
    tmdbId: movie.id,
    title: movie.title,
    year: movie.year,
    releaseDate: movie.releaseDate,
    posterPath: movie.posterPath,
    backdropPath: movie.backdropPath,
    overview: movie.overview,
    adult: movie.adult,
    popularity: movie.popularity,
    voteAverage: movie.voteAverage,
    voteCount: movie.voteCount,
    genres: movie.genres,
    director: null,
    seeds: seed ? [seed] : [],
    isWatchlist: false,
    libraryFilmId: null,
  };
}

function libraryCandidate(film: LibraryFilm): RecommendationCandidate {
  return {
    tmdbId: film.tmdbId as number,
    title: film.title,
    year: film.releaseYear,
    releaseDate: null,
    posterPath: film.posterPath,
    backdropPath: film.backdropPath,
    overview: film.overview ?? "",
    adult: false,
    popularity: 0,
    voteAverage: 0,
    voteCount: 0,
    genres: [
      ...new Set(
        [
          ...(film.tmdbGenres ?? []),
          film.genrePrimary,
          film.genreSecondary,
        ].filter((genre): genre is string => Boolean(genre)),
      ),
    ],
    director: film.director,
    seeds: [],
    isWatchlist: true,
    libraryFilmId: film.id,
  };
}

function upsertCandidate(
  byId: Map<number, RecommendationCandidate>,
  candidate: RecommendationCandidate,
) {
  const current = byId.get(candidate.tmdbId);
  if (!current) {
    byId.set(candidate.tmdbId, candidate);
    return;
  }
  byId.set(candidate.tmdbId, {
    ...candidate,
    ...current,
    director: current.director ?? candidate.director,
    backdropPath: current.backdropPath ?? candidate.backdropPath,
    genres: [...new Set([...current.genres, ...candidate.genres])],
    seeds: [
      ...new Map(
        [...current.seeds, ...candidate.seeds].map((seed) => [
          seed.tmdbId,
          seed,
        ]),
      ).values(),
    ],
    isWatchlist: current.isWatchlist || candidate.isWatchlist,
    libraryFilmId: current.libraryFilmId ?? candidate.libraryFilmId,
  });
}

async function settleWithConcurrency<T>(
  tasks: ReadonlyArray<() => Promise<T>>,
  limit: number,
) {
  const results: T[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < tasks.length) {
      const index = cursor;
      cursor += 1;
      try {
        results.push(await tasks[index]());
      } catch {
        // One TMDB source should not discard all other candidate sources.
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, () => worker()),
  );
  return results;
}

function unavailableRecommendations(
  generatedAt: string,
  error: string,
): RecommendationPayload {
  return {
    available: false,
    generatedAt,
    error,
    mode: "trending",
    personalWeight: 0,
    items: [],
  };
}

function clampLimit(limit: number) {
  if (!Number.isFinite(limit)) return 20;
  return Math.max(0, Math.min(100, Math.floor(limit)));
}
