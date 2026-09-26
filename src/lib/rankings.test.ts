import { describe, expect, it } from "vitest";
import {
  franchiseAverages,
  lastWatchedFilm,
  rankedFilms,
  scoreSpread,
  upNextFilms,
} from "./rankings";

function film(
  id: number,
  overrides: Partial<Parameters<typeof rankedFilms>[0][number]> = {},
) {
  return {
    id,
    title: `Film ${id}`,
    status: "watched",
    overall: null,
    franchise: null,
    lastWatchDate: null,
    watchOrder: null,
    ...overrides,
  };
}

describe("rankedFilms", () => {
  it("ranks rated films best first with shared ranks for ties", () => {
    const ranked = rankedFilms([
      film(1, { overall: 7 }),
      film(2, { overall: 9 }),
      film(3),
      film(4, { overall: 7 }),
    ]);
    expect(ranked.map(({ id, rank }) => [id, rank])).toEqual([
      [2, 1],
      [1, 2],
      [4, 2],
    ]);
  });
});

describe("scoreSpread", () => {
  it("bins by the displayed score and starts at the lowest occupied bin", () => {
    // Displayed: 5.0, 4.5, 4.4, 2.5
    const bins = scoreSpread([9.94, 8.95, 8.84, 4.92]);
    expect(bins[0]).toEqual({ start: 2.5, label: "2.5–2.9", count: 1 });
    expect(bins.at(-1)).toEqual({ start: 4.5, label: "4.5–5.0", count: 2 });
    expect(bins.find(({ start }) => start === 4)?.count).toBe(1);
    expect(bins.reduce((sum, { count }) => sum + count, 0)).toBe(4);
  });

  it("returns no bins without scores", () => {
    expect(scoreSpread([])).toEqual([]);
  });
});

describe("franchiseAverages", () => {
  it("averages rated films per franchise, best first", () => {
    expect(
      franchiseAverages([
        film(1, { franchise: "A", overall: 6 }),
        film(2, { franchise: "A", overall: 8 }),
        film(3, { franchise: "B", overall: 9 }),
        film(4, { franchise: "B" }),
        film(5, { overall: 10 }),
      ]),
    ).toEqual([
      { name: "B", count: 1, average: 9 },
      { name: "A", count: 2, average: 7 },
    ]);
  });
});

describe("lastWatchedFilm", () => {
  it("picks the latest watch date", () => {
    expect(
      lastWatchedFilm([
        film(1, { lastWatchDate: "2026-07-11" }),
        film(2, { lastWatchDate: "2026-09-25" }),
        film(3),
      ])?.id,
    ).toBe(2);
    expect(lastWatchedFilm([film(1)])).toBeNull();
  });
});

describe("upNextFilms", () => {
  it("lists the watchlist in saved order, then rewatches", () => {
    expect(
      upNextFilms([
        film(1, { status: "to_rewatch" }),
        film(2, { status: "to_watch", watchOrder: 2 }),
        film(3, { status: "to_watch", watchOrder: 1 }),
        film(4),
      ]).map(({ id }) => id),
    ).toEqual([3, 2, 1]);
  });
});
