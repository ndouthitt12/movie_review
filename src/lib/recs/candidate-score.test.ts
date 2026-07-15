import { describe, expect, it } from "vitest";
import {
  CANDIDATE_SCORE_WEIGHTS,
  scoreCandidate,
  type RecommendationCandidate,
} from "./candidate-score";
import { neutralTasteProfile } from "./taste-profile";

const candidate: RecommendationCandidate = {
  tmdbId: 100,
  title: "Candidate",
  year: 2025,
  releaseDate: "2025-04-01",
  posterPath: "/poster.jpg",
  backdropPath: "/backdrop.jpg",
  overview: "",
  adult: false,
  popularity: 20,
  voteAverage: 8.4,
  voteCount: 2500,
  genres: ["Science Fiction", "Drama"],
  director: "Denis Villeneuve",
  seeds: [
    {
      tmdbId: 1,
      title: "Dune: Part Two",
      score: 0.8,
      displayRating: 4.6,
    },
  ],
  isWatchlist: false,
  libraryFilmId: null,
};

describe("scoreCandidate", () => {
  it("keeps the exported tuning weights normalized", () => {
    expect(
      Object.values(CANDIDATE_SCORE_WEIGHTS).reduce(
        (sum, weight) => sum + weight,
        0,
      ),
    ).toBeCloseTo(1, 9);
  });

  it("scores a strong taste match above a neutral candidate", () => {
    const profile = neutralTasteProfile();
    profile.sampleSize = 10;
    profile.genreAffinity = { "Science Fiction": 0.8, Drama: 0.2 };
    profile.directorAffinity = { "Denis Villeneuve": 0.75 };
    profile.eraAffinity = { "2020s": 0.3 };
    const matched = scoreCandidate(
      candidate,
      profile,
      new Date("2026-07-15T00:00:00Z"),
    );
    const neutral = scoreCandidate(
      { ...candidate, genres: [], director: null, seeds: [] },
      neutralTasteProfile(),
      new Date("2026-07-15T00:00:00Z"),
    );
    expect(matched.matchScore).toBeGreaterThan(neutral.matchScore);
    expect(matched.reasons).toContain(
      "Because you rated Dune: Part Two 4.6",
    );
    expect(matched.reasons).toContain(
      "You rate Denis Villeneuve films highly",
    );
  });

  it("shrinks the TMDB quality component when vote count is low", () => {
    const popular = scoreCandidate(candidate, neutralTasteProfile());
    const obscure = scoreCandidate(
      { ...candidate, voteCount: 2 },
      neutralTasteProfile(),
    );
    expect(popular.components.quality).toBeGreaterThan(
      obscure.components.quality,
    );
  });

  it("surfaces watchlist provenance as the first reason", () => {
    expect(
      scoreCandidate(
        { ...candidate, isWatchlist: true },
        neutralTasteProfile(),
      ).reasons[0],
    ).toBe("From your watchlist");
  });
});
