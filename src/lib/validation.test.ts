import { describe, expect, it } from "vitest";
import {
  filmCreateSchema,
  ratingSchema,
  reorderSchema,
  watchSchema,
} from "./validation";

describe("Phase 2 mutation validation", () => {
  it("accepts a complete manual film", () => {
    expect(
      filmCreateSchema.safeParse({
        tmdbId: null,
        title: "Primer",
        releaseYear: 2004,
        status: "to_watch",
        tmdbGenres: [],
      }).success,
    ).toBe(true);
  });

  it("rejects incomplete films and duplicate form answers", () => {
    expect(
      filmCreateSchema.safeParse({
        title: "",
        releaseYear: 1800,
        status: "watched",
      }).success,
    ).toBe(false);
    expect(
      ratingSchema.safeParse({
        formVersionId: 1,
        answers: [
          { questionId: 1, valueNumber: 50 },
          { questionId: 1, valueNumber: 60 },
        ],
      }).success,
    ).toBe(false);
  });

  it("requires ISO watch dates and unique ordering is checked by the route", () => {
    expect(
      watchSchema.safeParse({ watchedOn: "07/12/2026", isRewatch: false })
        .success,
    ).toBe(false);
    expect(
      watchSchema.safeParse({ watchedOn: "2026-07-12", isRewatch: true })
        .success,
    ).toBe(true);
    expect(reorderSchema.safeParse({ filmIds: [] }).success).toBe(false);
  });
});
