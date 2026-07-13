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

  it("rejects incomplete films and scores outside 0-100", () => {
    expect(
      filmCreateSchema.safeParse({
        title: "",
        releaseYear: 1800,
        status: "watched",
      }).success,
    ).toBe(false);
    expect(
      ratingSchema.safeParse({
        story: 101,
        direction: 50,
        writing: 50,
        acting: 50,
        music: 50,
        impact: 50,
        rewatchability: 50,
        genreFit: 50,
        quality: 50,
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
