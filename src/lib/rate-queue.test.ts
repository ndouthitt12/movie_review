import { describe, expect, it } from "vitest";
import { rateQueue, type RateQueueFilm } from "./rate-queue";

function film(
  id: number,
  overrides: Partial<RateQueueFilm> = {},
): RateQueueFilm {
  return {
    id,
    title: `Film ${id}`,
    releaseYear: 2000,
    posterPath: null,
    status: "watched",
    watchOrder: null,
    lastWatchDate: null,
    overall: 8,
    ...overrides,
  };
}

describe("rateQueue", () => {
  const films = [
    film(1, { overall: null, lastWatchDate: "2026-07-01" }),
    film(2, { overall: null, lastWatchDate: "2026-09-01" }),
    film(3, { status: "to_watch", overall: null, watchOrder: 2 }),
    film(4, { status: "to_watch", overall: null, watchOrder: 1 }),
    film(5, { lastWatchDate: "2026-08-01" }),
    film(6, { lastWatchDate: "2026-09-20" }),
    film(7),
    film(8, {
      status: "to_rewatch",
      overall: null,
      lastWatchDate: "2026-01-01",
    }),
  ];

  it("lists watched films without a rating, latest watch first", () => {
    expect(rateQueue(films).unrated.map(({ id }) => id)).toEqual([2, 1, 8]);
  });

  it("lists the watchlist in its saved order", () => {
    expect(rateQueue(films).watchlist.map(({ id }) => id)).toEqual([4, 3]);
  });

  it("lists rated films with a watch date, latest first", () => {
    expect(rateQueue(films).recent.map(({ id }) => id)).toEqual([6, 5]);
  });

  it("caps each list", () => {
    expect(rateQueue(films, 1).unrated).toHaveLength(1);
  });

  it("returns only the fields the picker shows", () => {
    expect(Object.keys(rateQueue(films).unrated[0]).sort()).toEqual([
      "id",
      "lastWatchDate",
      "posterPath",
      "releaseYear",
      "title",
    ]);
  });
});
