import type { TmdbMoviePage } from "../tmdb";
import type { RecommendationLibraryIndex } from "./recommend";
import type { TasteProfile } from "./taste-profile";

export type TrendingItem = {
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string;
  backdropPath: string;
  rating: number;
  voteAverage: number;
  popularity: number;
  genres: string[];
  inLibrary: boolean;
  libraryFilmId: number | null;
  badge?: "Watchlist" | "Rated" | "In library" | "Rewatch";
  rankingScore: number;
};

export function rankTrending(
  page: TmdbMoviePage,
  profile: TasteProfile,
  libraryIndex: RecommendationLibraryIndex,
  limit = 100,
): TrendingItem[] {
  const eligible = page.results.filter(
    (movie): movie is typeof movie & {
      posterPath: string;
      backdropPath: string;
    } => !movie.adult && Boolean(movie.posterPath && movie.backdropPath),
  );
  const maximumPopularity = Math.max(
    1,
    ...eligible.map(({ popularity }) => popularity),
  );
  return eligible
    .map((movie, originalIndex) => {
      const entry = libraryIndex[movie.id];
      const genreAffinity = mean(
        movie.genres.map((genre) => profile.genreAffinity[genre] ?? 0),
      );
      const popularityScore = movie.popularity / maximumPopularity;
      let rankingScore = popularityScore * (1 + 0.35 * genreAffinity);
      if (entry?.status === "to_watch") rankingScore += 0.08;
      if (entry?.overall !== null && entry?.overall !== undefined)
        rankingScore -= 2;
      else if (entry?.status === "watched" || entry?.status === "to_rewatch")
        rankingScore -= 0.5;
      const rating = round(
        entry?.overall !== null && entry?.overall !== undefined
          ? entry.overall / 2
          : movie.voteAverage / 2,
      );
      return {
        tmdbId: movie.id,
        title: movie.title,
        year: movie.year,
        posterPath: movie.posterPath,
        backdropPath: movie.backdropPath,
        rating,
        voteAverage: movie.voteAverage,
        popularity: movie.popularity,
        genres: movie.genres,
        inLibrary: Boolean(entry),
        libraryFilmId: entry?.filmId ?? null,
        badge: badgeFor(entry),
        rankingScore: roundRanking(rankingScore),
        originalIndex,
      };
    })
    .sort(
      (left, right) =>
        right.rankingScore - left.rankingScore ||
        left.originalIndex - right.originalIndex ||
        left.tmdbId - right.tmdbId,
    )
    .slice(0, Math.max(0, Math.floor(limit)))
    .map((ranked) => {
      const item: Omit<typeof ranked, "originalIndex"> & {
        originalIndex?: number;
      } = { ...ranked };
      delete item.originalIndex;
      return item;
    });
}

function badgeFor(entry: RecommendationLibraryIndex[number] | undefined) {
  if (!entry) return undefined;
  if (entry.status === "to_watch") return "Watchlist" as const;
  if (entry.overall !== null) return "Rated" as const;
  if (entry.status === "to_rewatch") return "Rewatch" as const;
  return "In library" as const;
}

function mean(values: readonly number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function roundRanking(value: number) {
  return Math.round(value * 1000) / 1000;
}
