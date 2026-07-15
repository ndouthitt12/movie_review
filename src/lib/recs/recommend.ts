import type { TmdbMovieSummary } from "../tmdb";
import {
  scoreCandidate,
  type CandidateScore,
  type RecommendationCandidate,
} from "./candidate-score";
import {
  isNeutralTasteProfile,
  type TasteProfile,
} from "./taste-profile";

export type RecommendationMode = "personalized" | "blended" | "trending";

export type RecommendationLibraryEntry = {
  filmId: number;
  status: "watched" | "to_watch" | "to_rewatch";
  overall: number | null;
};

export type RecommendationLibraryIndex = Record<
  number,
  RecommendationLibraryEntry
>;

export type RecommendationItem = CandidateScore & {
  score: number;
  trendingRankScore: number;
};

export type RecommendationResult = {
  mode: RecommendationMode;
  personalWeight: number;
  items: RecommendationItem[];
};

export type RecommendMoviesInput = {
  candidates: readonly RecommendationCandidate[];
  trending: readonly TmdbMovieSummary[];
  profile: TasteProfile;
  libraryIndex?: RecommendationLibraryIndex;
  limit?: number;
  now?: Date;
};

export function recommendMovies({
  candidates,
  trending,
  profile,
  libraryIndex = {},
  limit = 20,
  now = new Date(),
}: RecommendMoviesInput): RecommendationResult {
  const safeLimit = Math.max(0, Math.floor(limit));
  if (isNeutralTasteProfile(profile)) {
    const items = trending
      .filter(
        (movie) =>
          !movie.adult &&
          Boolean(movie.posterPath) &&
          libraryIndex[movie.id] === undefined,
      )
      .slice(0, safeLimit)
      .map((movie, index, values) =>
        coldStartItem(movie, trendingRank(index, values.length)),
      );
    return { mode: "trending", personalWeight: 0, items };
  }

  const trendingScores = new Map(
    trending.map((movie, index) => [
      movie.id,
      trendingRank(index, trending.length),
    ]),
  );
  const combined = mergeCandidates([
    ...candidates,
    ...trending.map(summaryToCandidate),
  ]);
  const personalWeight = Math.min(1, profile.sampleSize / 10);
  const mode: RecommendationMode =
    profile.sampleSize < 5 ? "blended" : "personalized";
  const scored = combined
    .filter((candidate) => isEligible(candidate, profile, libraryIndex))
    .map((candidate) => {
      const libraryEntry = libraryIndex[candidate.tmdbId];
      const prepared = libraryEntry?.status === "to_watch"
        ? {
            ...candidate,
            isWatchlist: true,
            libraryFilmId: libraryEntry.filmId,
          }
        : candidate;
      const match = scoreCandidate(prepared, profile, now);
      const trendingRankScore = trendingScores.get(candidate.tmdbId) ?? 0;
      return {
        ...match,
        score: round(
          personalWeight * match.matchScore +
            (1 - personalWeight) * trendingRankScore,
        ),
        trendingRankScore,
      };
    });
  return {
    mode,
    personalWeight,
    items: diversifyRecommendations(scored, safeLimit),
  };
}

export function diversifyRecommendations(
  candidates: readonly RecommendationItem[],
  limit = candidates.length,
) {
  const remaining = [...candidates];
  const picked: RecommendationItem[] = [];
  while (remaining.length && picked.length < limit) {
    const ranked = remaining
      .map((candidate) => ({
        candidate,
        adjustedScore:
          candidate.score *
          Math.max(
            0,
            1 -
              0.15 * sharedPrimaryGenreCount(candidate, picked) -
              0.3 * sharedDirectorCount(candidate, picked),
          ),
      }))
      .sort(
        (left, right) =>
          right.adjustedScore - left.adjustedScore ||
          right.candidate.score - left.candidate.score ||
          left.candidate.tmdbId - right.candidate.tmdbId,
      );
    const selected = ranked[0].candidate;
    picked.push(selected);
    remaining.splice(
      remaining.findIndex(({ tmdbId }) => tmdbId === selected.tmdbId),
      1,
    );
  }
  return picked;
}

function isEligible(
  candidate: RecommendationCandidate,
  profile: TasteProfile,
  libraryIndex: RecommendationLibraryIndex,
) {
  if (candidate.adult || !candidate.posterPath) return false;
  if (profile.ratedTmdbIds.has(candidate.tmdbId)) return false;
  const entry = libraryIndex[candidate.tmdbId];
  return !entry || entry.status === "to_watch";
}

function mergeCandidates(candidates: readonly RecommendationCandidate[]) {
  const byId = new Map<number, RecommendationCandidate>();
  for (const candidate of candidates) {
    const previous = byId.get(candidate.tmdbId);
    if (!previous) {
      byId.set(candidate.tmdbId, candidate);
      continue;
    }
    byId.set(candidate.tmdbId, {
      ...candidate,
      ...previous,
      backdropPath: previous.backdropPath ?? candidate.backdropPath,
      director: previous.director ?? candidate.director,
      genres: [...new Set([...previous.genres, ...candidate.genres])],
      seeds: uniqueSeeds([...previous.seeds, ...candidate.seeds]),
      isWatchlist: previous.isWatchlist || candidate.isWatchlist,
      libraryFilmId: previous.libraryFilmId ?? candidate.libraryFilmId,
    });
  }
  return [...byId.values()];
}

function uniqueSeeds(seeds: RecommendationCandidate["seeds"]) {
  return [...new Map(seeds.map((seed) => [seed.tmdbId, seed])).values()];
}

function summaryToCandidate(movie: TmdbMovieSummary): RecommendationCandidate {
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
    seeds: [],
    isWatchlist: false,
    libraryFilmId: null,
  };
}

function coldStartItem(
  movie: TmdbMovieSummary,
  trendingRankScore: number,
): RecommendationItem {
  return {
    ...summaryToCandidate(movie),
    matchScore: 0,
    score: trendingRankScore,
    trendingRankScore,
    reasons: [],
    components: {
      genre: 0,
      seed: 0,
      director: 0,
      quality: 0,
      era: 0,
      recentRelease: 0,
    },
  };
}

function trendingRank(index: number, length: number) {
  if (length <= 1) return 100;
  return round(100 * (1 - index / (length - 1)));
}

function sharedPrimaryGenreCount(
  candidate: RecommendationItem,
  picked: readonly RecommendationItem[],
) {
  const primary = candidate.genres[0];
  if (!primary) return 0;
  return picked.filter(({ genres }) => genres[0] === primary).length;
}

function sharedDirectorCount(
  candidate: RecommendationItem,
  picked: readonly RecommendationItem[],
) {
  if (!candidate.director) return 0;
  return picked.filter(({ director }) => director === candidate.director)
    .length;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
