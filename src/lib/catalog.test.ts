import { beforeEach, describe, expect, it, vi } from "vitest";

const dbState = vi.hoisted(() => ({
  resultSets: [] as unknown[][],
  selectCount: 0,
}));

vi.mock("@/db", () => {
  class QueryBuilder implements PromiseLike<unknown[]> {
    constructor(private readonly rows: unknown[]) {}

    from() {
      return this;
    }

    leftJoin() {
      return this;
    }

    innerJoin() {
      return this;
    }

    orderBy() {
      return this;
    }

    then<TResult1 = unknown[], TResult2 = never>(
      onfulfilled?:
        ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?:
        ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
      return Promise.resolve(this.rows).then(onfulfilled, onrejected);
    }
  }

  return {
    db: {
      select: () =>
        new QueryBuilder(dbState.resultSets[dbState.selectCount++] ?? []),
    },
  };
});

import { getLibraryFilms } from "./catalog";

describe("getLibraryFilms", () => {
  beforeEach(() => {
    dbState.selectCount = 0;
    dbState.resultSets = [
      [
        {
          id: 2,
          title: "First by watch order",
          watchOrder: 1,
          formVersionId: null,
          overall: null,
        },
        {
          id: 1,
          title: "Rated film",
          watchOrder: 2,
          formVersionId: 4,
          overall: 8.4,
        },
        {
          id: 1,
          title: "Duplicate rating row",
          watchOrder: 2,
          formVersionId: 5,
          overall: 7.2,
        },
      ],
      [
        {
          filmId: 1,
          id: 11,
          label: "Character work",
          attribute: "acting",
          polarity: "positive",
          color: "#00ff00",
        },
        {
          filmId: 1,
          id: 12,
          label: "Weak pacing",
          attribute: "direction",
          polarity: "negative",
          color: null,
        },
        {
          filmId: 1,
          id: 11,
          label: "Character work",
          attribute: "acting",
          polarity: "positive",
          color: "#00ff00",
        },
      ],
      [
        { filmId: 1, key: "story", value: 8 },
        { filmId: 1, key: "genre_fit", value: 9 },
        { filmId: 1, key: "music", value: null },
        { filmId: 1, key: "story", value: 8.5 },
      ],
    ];
  });

  it("merges scores and deduplicated tags without changing film order", async () => {
    const result = await getLibraryFilms();

    expect(dbState.selectCount).toBe(3);
    expect(result.map(({ id }) => id)).toEqual([2, 1]);
    expect(result[0]).toMatchObject({
      story: null,
      direction: null,
      writing: null,
      acting: null,
      music: null,
      impact: null,
      rewatchability: null,
      genreFit: null,
      rcaTags: [],
    });
    expect(result[1]).toMatchObject({
      title: "Rated film",
      formVersionId: 4,
      overall: 8.4,
      story: 8.5,
      direction: null,
      writing: null,
      acting: null,
      music: null,
      impact: null,
      rewatchability: null,
      genreFit: 9,
      rcaTags: [
        {
          id: 11,
          label: "Character work",
          attribute: "acting",
          polarity: "positive",
          color: "#00ff00",
        },
        {
          id: 12,
          label: "Weak pacing",
          attribute: "direction",
          polarity: "negative",
          color: null,
        },
      ],
    });
  });
});
