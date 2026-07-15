import { describe, expect, it } from "vitest";
import type { TmdbMovieSummary } from "../tmdb";
import type { RecommendationCandidate } from "./candidate-score";
import {
  diversifyRecommendations,
  recommendMovies,
  type RecommendationItem,
} from "./recommend";
import { neutralTasteProfile } from "./taste-profile";

function summary(
  id: number,
  input: Partial<TmdbMovieSummary> = {},
): TmdbMovieSummary {
  return {
    id,
    title: `Film ${id}`,
    year: 2025,
    releaseDate: "2025-01-01",
    posterPath: `/poster-${id}.jpg`,
    backdropPath: `/backdrop-${id}.jpg`,
    overview: "",
    adult: false,
    popularity: 100 - id,
    voteAverage: 8,
    voteCount: 1000,
    genreIds: [18],
    genres: ["Drama"],
    ...input,
  };
}

function candidate(
  id: number,
  input: Partial<RecommendationCandidate> = {},
): RecommendationCandidate {
  const movie = summary(id);
  return {
    tmdbId: id,
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
    ...input,
  };
}

describe("recommendMovies", () => {
  it("uses pure TMDB order for a cold start and removes library titles", () => {
    const result = recommendMovies({
      candidates: [],
      trending: [
        summary(1),
        summary(2),
        summary(3, { posterPath: null }),
        summary(4),
      ],
      profile: neutralTasteProfile(),
      libraryIndex: {
        2: { filmId: 22, status: "to_watch", overall: null },
      },
    });
    expect(result.mode).toBe("trending");
    expect(result.personalWeight).toBe(0);
    expect(result.items.map(({ tmdbId }) => tmdbId)).toEqual([1, 4]);
    expect(result.items.every(({ reasons }) => reasons.length === 0)).toBe(
      true,
    );
  });

  it("blends personal and trending scores for one to four ratings", () => {
    const profile = neutralTasteProfile();
    profile.sampleSize = 2;
    profile.genreAffinity = { Drama: 0.8 };
    const result = recommendMovies({
      candidates: [candidate(10)],
      trending: [summary(20), summary(10)],
      profile,
    });
    expect(result.mode).toBe("blended");
    expect(result.personalWeight).toBe(0.2);
    expect(result.items.find(({ tmdbId }) => tmdbId === 10)?.score).toBeGreaterThan(
      0,
    );
  });

  it("switches the result mode at five ratings while trending fades to ten", () => {
    const profile = neutralTasteProfile();
    profile.sampleSize = 5;
    profile.genreAffinity = { Drama: 0.5 };
    const result = recommendMovies({
      candidates: [candidate(10)],
      trending: [summary(10)],
      profile,
    });
    expect(result.mode).toBe("personalized");
    expect(result.personalWeight).toBe(0.5);
  });

  it("filters adult, posterless, rated, and watched candidates", () => {
    const profile = neutralTasteProfile();
    profile.sampleSize = 5;
    profile.genreAffinity = { Drama: 0.5 };
    profile.ratedTmdbIds.add(1);
    const result = recommendMovies({
      candidates: [
        candidate(1),
        candidate(2, { adult: true }),
        candidate(3, { posterPath: null }),
        candidate(4),
        candidate(5),
      ],
      trending: [],
      profile,
      libraryIndex: {
        4: { filmId: 40, status: "watched", overall: null },
        5: { filmId: 50, status: "to_watch", overall: null },
      },
    });
    expect(result.items.map(({ tmdbId }) => tmdbId)).toEqual([5]);
    expect(result.items[0]).toMatchObject({
      isWatchlist: true,
      libraryFilmId: 50,
    });
  });
});

describe("diversifyRecommendations", () => {
  function item(
    id: number,
    score: number,
    genre: string,
    director: string,
  ): RecommendationItem {
    return {
      ...candidate(id, { genres: [genre], director }),
      matchScore: score,
      score,
      trendingRankScore: 0,
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

  it("greedily promotes variety without randomness", () => {
    const candidates = [
      item(1, 100, "Science Fiction", "Director A"),
      item(2, 99, "Science Fiction", "Director B"),
      item(3, 90, "Drama", "Director C"),
    ];
    expect(
      diversifyRecommendations(candidates).map(({ tmdbId }) => tmdbId),
    ).toEqual([1, 3, 2]);
    expect(
      diversifyRecommendations(candidates).map(({ tmdbId }) => tmdbId),
    ).toEqual([1, 3, 2]);
  });
});
