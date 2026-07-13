import { describe, expect, it } from "vitest";
import { mapTmdbMovie, tmdbImage } from "./tmdb";

describe("TMDB mapping", () => {
  it("maps details and extracts the director", () => {
    expect(
      mapTmdbMovie({
        id: 11,
        title: "Star Wars",
        release_date: "1977-05-25",
        poster_path: "/poster.jpg",
        backdrop_path: "/backdrop.jpg",
        overview: "A long time ago.",
        runtime: 121,
        genres: [{ name: "Adventure" }],
        credits: { crew: [{ job: "Director", name: "George Lucas" }] },
      }),
    ).toEqual({
      id: 11,
      title: "Star Wars",
      year: 1977,
      director: "George Lucas",
      posterPath: "/poster.jpg",
      backdropPath: "/backdrop.jpg",
      overview: "A long time ago.",
      runtime: 121,
      genres: ["Adventure"],
    });
  });

  it("handles missing dates and images", () => {
    expect(mapTmdbMovie({ id: 1, title: "Unknown" }).year).toBeNull();
    expect(tmdbImage(null, "w342")).toBeNull();
    expect(tmdbImage("/a.jpg", "w342")).toBe(
      "https://image.tmdb.org/t/p/w342/a.jpg",
    );
  });
});
