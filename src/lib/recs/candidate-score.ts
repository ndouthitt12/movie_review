import type { TasteProfile } from "./taste-profile";

export const CANDIDATE_SCORE_WEIGHTS = {
  // Broad taste match across all of the candidate's known genres.
  genre: 0.3,
  // Similar/recommended results inherit confidence from their best seed film.
  seed: 0.25,
  // A known director is a strong but intentionally narrower signal.
  director: 0.15,
  // TMDB quality is Bayesian-shrunk so a handful of votes cannot dominate.
  quality: 0.2,
  // Release-decade preference is a gentle tie-breaker.
  era: 0.05,
  // Recent releases get a small discovery boost, never a dominant one.
  recentRelease: 0.05,
} as const;

export type RecommendationSeed = {
  tmdbId: number;
  title: string;
  score: number;
  displayRating: number;
};

export type RecommendationCandidate = {
  tmdbId: number;
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
  genres: string[];
  director: string | null;
  seeds: RecommendationSeed[];
  isWatchlist: boolean;
  libraryFilmId: number | null;
};

export type CandidateScore = RecommendationCandidate & {
  matchScore: number;
  reasons: string[];
  components: {
    genre: number;
    seed: number;
    director: number;
    quality: number;
    era: number;
    recentRelease: number;
  };
};

export function scoreCandidate(
  candidate: RecommendationCandidate,
  profile: TasteProfile,
  now = new Date(),
): CandidateScore {
  const matchedGenres = candidate.genres
    .map((genre) => ({ genre, affinity: profile.genreAffinity[genre] ?? 0 }))
    .sort(
      (left, right) =>
        right.affinity - left.affinity || left.genre.localeCompare(right.genre),
    );
  const genre = mean(matchedGenres.map(({ affinity }) => affinity));
  const director = candidate.director
    ? (profile.directorAffinity[candidate.director] ?? 0)
    : 0;
  const bestSeed = [...candidate.seeds].sort(
    (left, right) =>
      right.score - left.score || left.tmdbId - right.tmdbId,
  )[0];
  const seed = bestSeed?.score ?? 0;
  const voteConfidence = candidate.voteCount / (candidate.voteCount + 500);
  const quality = clamp((candidate.voteAverage / 10 - 0.5) * 2, -1, 1) *
    voteConfidence;
  const era = candidate.year
    ? (profile.eraAffinity[`${Math.floor(candidate.year / 10) * 10}s`] ?? 0)
    : 0;
  const recentRelease = recentReleaseBonus(candidate.year, now.getUTCFullYear());
  const weighted =
    CANDIDATE_SCORE_WEIGHTS.genre * genre +
    CANDIDATE_SCORE_WEIGHTS.seed * seed +
    CANDIDATE_SCORE_WEIGHTS.director * director +
    CANDIDATE_SCORE_WEIGHTS.quality * quality +
    CANDIDATE_SCORE_WEIGHTS.era * era +
    CANDIDATE_SCORE_WEIGHTS.recentRelease * recentRelease;
  const reasons: string[] = [];
  if (candidate.isWatchlist) reasons.push("From your watchlist");
  if (bestSeed && bestSeed.score > 0.05)
    reasons.push(
      `Because you rated ${bestSeed.title} ${bestSeed.displayRating.toFixed(1)}`,
    );
  if (candidate.director && director > 0.05)
    reasons.push(`You rate ${candidate.director} films highly`);
  const bestGenre = matchedGenres.find(({ affinity }) => affinity > 0.05);
  if (bestGenre) reasons.push(`Matches your love of ${bestGenre.genre}`);
  if (quality > 0.25) reasons.push("Highly rated by TMDB viewers");

  return {
    ...candidate,
    matchScore: round(100 * sigmoid(weighted)),
    reasons: reasons.slice(0, 3),
    components: {
      genre,
      seed,
      director,
      quality,
      era,
      recentRelease,
    },
  };
}

function recentReleaseBonus(year: number | null, currentYear: number) {
  if (year === null) return 0;
  const age = currentYear - year;
  if (age < 0) return 0.5;
  if (age > 2) return 0;
  return 1 - age * 0.25;
}

function mean(values: readonly number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function sigmoid(value: number) {
  return 1 / (1 + Math.exp(-value));
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
