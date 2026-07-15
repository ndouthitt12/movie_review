import { describe, expect, it } from "vitest";
import {
  mapTmdbMovie,
  mapTmdbMoviePage,
  mapTmdbVideos,
  selectTmdbTrailer,
  tmdbGenreId,
  tmdbImage,
} from "./tmdb";

describe("TMDB mapping", () => {
  it("maps enriched details, credits, keywords, and collection metadata", () => {
    expect(
      mapTmdbMovie({
        id: 11,
        title: "Star Wars",
        release_date: "1977-05-25",
        poster_path: "/poster.jpg",
        backdrop_path: "/backdrop.jpg",
        overview: "A long time ago.",
        runtime: 121,
        popularity: 42,
        vote_average: 8.2,
        vote_count: 20000,
        genres: [{ id: 12, name: "Adventure" }],
        belongs_to_collection: { id: 10 },
        credits: {
          crew: [{ job: "Director", name: "George Lucas" }],
          cast: [{ name: "Mark Hamill" }, { name: "Carrie Fisher" }],
        },
        keywords: { keywords: [{ name: "space opera" }] },
      }),
    ).toEqual(
      expect.objectContaining({
        id: 11,
        title: "Star Wars",
        year: 1977,
        releaseDate: "1977-05-25",
        director: "George Lucas",
        posterPath: "/poster.jpg",
        backdropPath: "/backdrop.jpg",
        overview: "A long time ago.",
        runtime: 121,
        genres: ["Adventure"],
        genreIds: [12],
        keywords: ["space opera"],
        cast: ["Mark Hamill", "Carrie Fisher"],
        collectionId: 10,
        voteAverage: 8.2,
        voteCount: 20000,
      }),
    );
  });

  it("maps paged list results and resolves standard genre ids", () => {
    const page = mapTmdbMoviePage({
      page: 2,
      total_pages: 4,
      total_results: 70,
      results: [
        {
          id: 1,
          title: "Arrival",
          release_date: "2016-11-11",
          genre_ids: [18, 878],
          vote_average: 7.6,
        },
      ],
    });
    expect(page).toMatchObject({ page: 2, totalPages: 4, totalResults: 70 });
    expect(page.results[0]).toMatchObject({
      title: "Arrival",
      genres: ["Drama", "Science Fiction"],
      voteAverage: 7.6,
    });
    expect(tmdbGenreId("Sci-Fi")).toBe(878);
  });

  it("selects the best available YouTube trailer deterministically", () => {
    const videos = mapTmdbVideos({
      results: [
        {
          id: "teaser",
          key: "teaser-key",
          name: "Teaser",
          site: "YouTube",
          type: "Teaser",
          official: true,
          published_at: "2024-01-01",
        },
        {
          id: "trailer",
          key: "trailer-key",
          name: "Trailer",
          site: "YouTube",
          type: "Trailer",
          official: true,
          published_at: "2024-02-01",
        },
        {
          id: "vimeo",
          key: "vimeo-key",
          site: "Vimeo",
          type: "Trailer",
          official: true,
        },
      ],
    });
    expect(selectTmdbTrailer(videos)?.key).toBe("trailer-key");
  });

  it("handles missing dates and images", () => {
    expect(mapTmdbMovie({ id: 1, title: "Unknown" }).year).toBeNull();
    expect(tmdbImage(null, "w342")).toBeNull();
    expect(tmdbImage("/a.jpg", "w342")).toBe(
      "https://image.tmdb.org/t/p/w342/a.jpg",
    );
  });
});
