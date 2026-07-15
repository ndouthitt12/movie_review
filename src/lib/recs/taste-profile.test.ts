import { describe, expect, it } from "vitest";
import {
  buildTasteProfile,
  isNeutralTasteProfile,
  neutralTasteProfile,
  recencyWeight,
  type TasteProfileFilm,
} from "./taste-profile";

const NOW = new Date("2026-07-15T00:00:00Z");

function film(
  input: Partial<TasteProfileFilm> &
    Pick<TasteProfileFilm, "tmdbId" | "overall" | "releaseYear">,
): TasteProfileFilm {
  return {
    status: "watched",
    lastWatchDate: "2026-01-01",
    genrePrimary: null,
    genreSecondary: null,
    tmdbGenres: [],
    director: null,
    rcaTags: [],
    story: input.overall === null ? null : input.overall * 10,
    direction: 50,
    writing: 50,
    acting: 50,
    music: input.overall === null ? null : 100 - input.overall * 10,
    impact: 50,
    rewatchability: 50,
    genreFit: 50,
    ...input,
  };
}

const fixture: TasteProfileFilm[] = [
  film({
    tmdbId: 1,
    overall: 9.6,
    releaseYear: 2024,
    genrePrimary: "Science Fiction",
    director: "Denis Villeneuve",
    franchiseId: 7,
    rcaTags: [{ label: "Immersive world", polarity: "positive" }],
  }),
  film({
    tmdbId: 2,
    overall: 9.2,
    releaseYear: 2021,
    genrePrimary: "Science Fiction",
    genreSecondary: "Drama",
    director: "Denis Villeneuve",
    rcaTags: [{ label: "Immersive world", polarity: "positive" }],
  }),
  film({
    tmdbId: 3,
    overall: 8.8,
    releaseYear: 2016,
    genrePrimary: "Science Fiction",
    director: "Denis Villeneuve",
  }),
  film({
    tmdbId: 4,
    overall: 8.2,
    releaseYear: 2019,
    genrePrimary: "Drama",
    director: "Greta Gerwig",
  }),
  film({
    tmdbId: 5,
    overall: 7.8,
    releaseYear: 2017,
    genrePrimary: "Drama",
    director: "Greta Gerwig",
  }),
  film({
    tmdbId: 6,
    overall: 5.8,
    releaseYear: 2008,
    genrePrimary: "Comedy",
    director: "Other Director",
  }),
  film({
    tmdbId: 7,
    overall: 4.2,
    releaseYear: 2005,
    genrePrimary: "Horror",
    director: "Horror Director",
    rcaTags: [{ label: "Weak ending", polarity: "negative" }],
  }),
  film({
    tmdbId: 8,
    overall: 3.8,
    releaseYear: 1998,
    genrePrimary: "Horror",
    director: "Horror Director",
    rcaTags: [{ label: "Weak ending", polarity: "negative" }],
  }),
  film({
    tmdbId: 9,
    overall: 3.2,
    releaseYear: 1992,
    genrePrimary: "Horror",
    director: "Horror Director",
  }),
  film({
    tmdbId: 10,
    overall: 6.4,
    releaseYear: 1985,
    genrePrimary: "Adventure",
    director: "Other Director",
  }),
  film({
    tmdbId: 11,
    overall: null,
    releaseYear: 2026,
    status: "to_watch",
    genrePrimary: "Action",
  }),
];

describe("buildTasteProfile", () => {
  it("learns signed genre, director, era, franchise, and RCA affinities", () => {
    const profile = buildTasteProfile(fixture, { now: NOW });
    expect(profile.sampleSize).toBe(10);
    expect(profile.genreAffinity["Science Fiction"]).toBeGreaterThan(
      profile.genreAffinity.Drama,
    );
    expect(profile.genreAffinity["Science Fiction"]).toBeGreaterThan(0);
    expect(profile.genreAffinity.Horror).toBeLessThan(0);
    expect(profile.directorAffinity["Denis Villeneuve"]).toBeGreaterThan(0);
    expect(profile.directorAffinity["Horror Director"]).toBeLessThan(0);
    expect(profile.eraAffinity["2020s"]).toBeGreaterThan(0);
    expect(profile.eraAffinity["1990s"]).toBeLessThan(0);
    expect(profile.positiveTagThemes["Immersive world"]).toBeGreaterThan(0);
    expect(profile.negativeTagThemes["Weak ending"]).toBeGreaterThan(0);
    expect(profile.franchiseIds).toEqual(new Set([7]));
    expect(profile.ratedTmdbIds.has(1)).toBe(true);
    expect(profile.watchlistTmdbIds).toEqual(new Set([11]));
  });

  it("uses correlations for attribute weights once the sample is large enough", () => {
    const profile = buildTasteProfile(fixture, { now: NOW });
    expect(profile.attributeWeights.story).toBeGreaterThan(
      profile.attributeWeights.direction,
    );
    expect(profile.attributeWeights.music).toBeGreaterThan(
      profile.attributeWeights.direction,
    );
    expect(
      Object.values(profile.attributeWeights).reduce(
        (sum, value) => sum + value,
        0,
      ),
    ).toBeCloseTo(1, 9);
  });

  it("shrinks a one-observation affinity more than a repeated affinity", () => {
    const profile = buildTasteProfile(
      [
        film({
          tmdbId: 1,
          overall: 10,
          releaseYear: 2020,
          genrePrimary: "Rare",
        }),
        film({
          tmdbId: 2,
          overall: 9,
          releaseYear: 2020,
          genrePrimary: "Repeated",
        }),
        film({
          tmdbId: 3,
          overall: 9,
          releaseYear: 2020,
          genrePrimary: "Repeated",
        }),
        film({
          tmdbId: 4,
          overall: 1,
          releaseYear: 2020,
          genrePrimary: "Control",
        }),
      ],
      { now: NOW },
    );
    expect(profile.genreAffinity.Repeated).toBeGreaterThan(
      profile.genreAffinity.Rare,
    );
  });

  it("applies the specified exponential recency decay", () => {
    const recent = recencyWeight("2026-07-15", NOW);
    const twoYearsOld = recencyWeight("2024-07-15", NOW);
    expect(recent).toBe(1);
    expect(twoYearsOld).toBeCloseTo(Math.exp(-1), 2);
  });

  it("returns neutral profiles for empty and single-rating libraries", () => {
    expect(buildTasteProfile([], { now: NOW })).toEqual(neutralTasteProfile());
    const single = buildTasteProfile(
      [
        film({
          tmdbId: 1,
          overall: 9,
          releaseYear: 2024,
          genrePrimary: "Drama",
        }),
      ],
      { now: NOW },
    );
    expect(single.sampleSize).toBe(1);
    expect(single.meanScore).toBe(9);
    expect(single.genreAffinity.Drama).toBe(0);
    expect(isNeutralTasteProfile(single)).toBe(true);
    expect(new Set(Object.values(single.attributeWeights)).size).toBe(1);
  });
});
