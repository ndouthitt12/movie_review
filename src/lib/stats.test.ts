import { describe, expect, it } from "vitest";
import {
  attributeAverages,
  attributeOverallCorrelations,
  decadeBreakdown,
  franchiseReportCards,
  genreBreakdown,
  headlineStats,
  overallHistogram,
  rcaTagFrequencies,
  watchesPerMonth,
  watchesPerYear,
  type DashboardFilm,
} from "./stats";

const films: DashboardFilm[] = [
  fixtureFilm({
    id: 1,
    title: "North",
    releaseYear: 1999,
    genrePrimary: "Drama",
    genreSecondary: "Thriller",
    franchise: "Compass",
    rating: rating(80, 8),
    rcaTags: [{ id: 4, label: "Sharp dialogue", questionKey: "writing" }],
  }),
  fixtureFilm({
    id: 2,
    title: "South",
    releaseYear: 2001,
    genrePrimary: "Drama",
    genreSecondary: null,
    franchise: "Compass",
    rating: rating(60, 6),
    rcaTags: [{ id: 4, label: "Sharp dialogue", questionKey: "writing" }],
  }),
  fixtureFilm({
    id: 3,
    title: "Future",
    releaseYear: 2030,
    status: "to_watch",
    genrePrimary: "Drama",
    rating: rating(100, 10),
    rcaTags: [{ id: 5, label: "Not watched yet", questionKey: "overall" }],
  }),
];
const attributes = [
  { key: "story", label: "Story" },
  { key: "writing", label: "Writing" },
  { key: "custom", label: "Custom score" },
];

describe("dashboard statistics", () => {
  it("builds fixed 0.5 score buckets and preserves the total", () => {
    const bins = overallHistogram([0, 0.49, 0.5, 10]);
    expect(bins).toHaveLength(20);
    expect(bins[0].count).toBe(2);
    expect(bins[1].count).toBe(1);
    expect(bins.at(-1)?.count).toBe(1);
    expect(bins.reduce((sum, bin) => sum + bin.expected, 0)).toBeCloseTo(4);
  });

  it("fills missing months and computes a trailing rolling average", () => {
    const watches = [
      { filmId: 1, watchedOn: "2026-01-02" },
      { filmId: 2, watchedOn: "2026-01-20" },
      { filmId: 1, watchedOn: "2026-03-05" },
      { filmId: 1, watchedOn: "2027-01-01" },
    ];
    expect(watchesPerMonth(watches, 3).slice(0, 3)).toEqual([
      { period: "2026-01", count: 2, rollingAverage: 2 },
      { period: "2026-02", count: 0, rollingAverage: 1 },
      { period: "2026-03", count: 1, rollingAverage: 1 },
    ]);
    expect(watchesPerYear(watches)).toEqual([
      { period: "2026", count: 3 },
      { period: "2027", count: 1 },
    ]);
    expect(watchesPerMonth(watches.slice(0, 2), 3, "2026-04")).toEqual([
      { period: "2026-01", count: 2, rollingAverage: 2 },
      { period: "2026-02", count: 0, rollingAverage: 1 },
      { period: "2026-03", count: 0, rollingAverage: 2 / 3 },
      { period: "2026-04", count: 0, rollingAverage: 0 },
    ]);
  });

  it("computes hand-checked profile, group, and correlation values", () => {
    expect(attributeAverages(films, attributes)[0].average).toBe(80);
    expect(genreBreakdown(films)).toEqual([
      { label: "Drama", count: 3, average: 8 },
      { label: "Thriller", count: 1, average: 8 },
    ]);
    expect(decadeBreakdown(films)).toEqual([
      { label: "1990s", count: 1, average: 8 },
      { label: "2000s", count: 1, average: 6 },
      { label: "2030s", count: 1, average: 10 },
    ]);
    expect(franchiseReportCards(films)).toEqual([
      { label: "Compass", count: 2, average: 7 },
    ]);
    expect(
      attributeOverallCorrelations(films, attributes)[0].correlation,
    ).toBeCloseTo(1);
    expect(headlineStats(films, [], "2026-01-01")).toMatchObject({
      totalWatched: 2,
      meanOverall: 8,
    });
  });

  it("counts RCA tags once per tagged film with the scoped score average", () => {
    expect(rcaTagFrequencies(films)).toEqual([
      {
        id: 4,
        label: "Sharp dialogue",
        questionKey: "writing",
        count: 2,
        averageScore: 70,
      },
      {
        id: 5,
        label: "Not watched yet",
        questionKey: "overall",
        count: 1,
        averageScore: 10,
      },
    ]);
  });
});

function fixtureFilm(
  overrides: Partial<DashboardFilm> &
    Pick<DashboardFilm, "id" | "title" | "releaseYear">,
): DashboardFilm {
  return {
    status: "watched",
    genrePrimary: null,
    genreSecondary: null,
    franchise: null,
    subFranchise: null,
    rating: null,
    rcaTags: [],
    ...overrides,
  };
}

function rating(attributeScore: number, overall: number) {
  return {
    values: {
      story: attributeScore,
      writing: attributeScore,
      custom: attributeScore,
    },
    overall,
  };
}
