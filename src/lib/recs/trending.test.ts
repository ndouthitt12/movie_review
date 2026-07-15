import { describe, expect, it } from "vitest";
import type { TmdbMoviePage, TmdbMovieSummary } from "../tmdb";
import { neutralTasteProfile } from "./taste-profile";
import { rankTrending } from "./trending";

function movie(
  id: number,
  popularity: number,
  genres: string[],
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
    popularity,
    voteAverage: 8,
    voteCount: 1000,
    genreIds: [],
    genres,
    ...input,
  };
}

function page(results: TmdbMovieSummary[]): TmdbMoviePage {
  return { page: 1, totalPages: 1, totalResults: results.length, results };
}

describe("rankTrending", () => {
  it("is a popularity passthrough for an empty profile", () => {
    const result = rankTrending(
      page([
        movie(1, 100, ["Action"]),
        movie(2, 80, ["Drama"]),
        movie(3, 60, ["Comedy"]),
      ]),
      neutralTasteProfile(),
      {},
    );
    expect(result.map(({ tmdbId }) => tmdbId)).toEqual([1, 2, 3]);
  });

  it("uses affinity to reorder close popularity scores", () => {
    const profile = neutralTasteProfile();
    profile.genreAffinity = { Horror: -1, Drama: 1 };
    const result = rankTrending(
      page([
        movie(1, 100, ["Horror"]),
        movie(2, 96, ["Drama"]),
        movie(3, 60, ["Comedy"]),
      ]),
      profile,
      {},
    );
    expect(result.map(({ tmdbId }) => tmdbId)).toEqual([2, 1, 3]);
  });

  it("keeps rated films but sinks them below unrated titles", () => {
    const result = rankTrending(
      page([movie(1, 100, ["Drama"]), movie(2, 50, ["Drama"])]),
      neutralTasteProfile(),
      {
        1: { filmId: 10, status: "watched", overall: 9.2 },
      },
    );
    expect(result.map(({ tmdbId }) => tmdbId)).toEqual([2, 1]);
    expect(result[1]).toMatchObject({
      inLibrary: true,
      libraryFilmId: 10,
      badge: "Rated",
      rating: 4.6,
    });
  });

  it("boosts and badges watchlist items while using TMDB display ratings", () => {
    const result = rankTrending(
      page([
        movie(1, 100, ["Drama"]),
        movie(2, 95, ["Drama"], { voteAverage: 7.7 }),
      ]),
      neutralTasteProfile(),
      {
        2: { filmId: 20, status: "to_watch", overall: null },
      },
    );
    expect(result[0]).toMatchObject({
      tmdbId: 2,
      badge: "Watchlist",
      rating: 3.9,
    });
  });

  it("filters adult titles and incomplete artwork", () => {
    const result = rankTrending(
      page([
        movie(1, 100, [], { adult: true }),
        movie(2, 90, [], { posterPath: null }),
        movie(3, 80, [], { backdropPath: null }),
        movie(4, 70, []),
      ]),
      neutralTasteProfile(),
      {},
    );
    expect(result.map(({ tmdbId }) => tmdbId)).toEqual([4]);
  });
});
