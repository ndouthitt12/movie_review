import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  discoverTmdbMovies,
  getTmdbMovie,
  getTmdbRecommendations,
  getTmdbSimilar,
  getTmdbTrending,
  getTmdbVideos,
  searchTmdb,
  searchTmdbPerson,
} from "./tmdb-server";

const summary = {
  id: 101,
  title: "Test Film",
  release_date: "2025-05-01",
  poster_path: "/poster.jpg",
  backdrop_path: "/backdrop.jpg",
  overview: "A fixture.",
  genre_ids: [18],
  popularity: 25,
  vote_average: 8,
  vote_count: 500,
};

const fetchMock = vi.fn(async (input: string | URL | Request) => {
  const url = new URL(String(input));
  if (url.searchParams.get("query")?.includes("rate-limit"))
    return new Response(JSON.stringify({ status_message: "rate limited" }), {
      status: 429,
    });
  if (url.pathname === "/3/search/movie")
    return Response.json({
      page: 1,
      results: url.searchParams.get("query")?.startsWith("cache-test")
        ? []
        : [summary],
    });
  if (url.pathname === "/3/search/person")
    return Response.json({
      results: [
        {
          id: 42,
          name: "Fixture Director",
          known_for_department: "Directing",
          profile_path: "/person.jpg",
        },
      ],
    });
  if (url.pathname.endsWith("/videos"))
    return Response.json({
      results: [
        {
          id: "video-1",
          key: "youtube-key",
          name: "Official Trailer",
          site: "YouTube",
          type: "Trailer",
          official: true,
        },
      ],
    });
  if (
    url.pathname.includes("/trending/movie/") ||
    url.pathname === "/3/discover/movie" ||
    url.pathname.endsWith("/recommendations") ||
    url.pathname.endsWith("/similar")
  )
    return Response.json({
      page: 1,
      total_pages: 1,
      total_results: 1,
      results: [summary],
    });
  if (/\/3\/movie\/\d+$/.test(url.pathname))
    return Response.json({
      ...summary,
      genres: [{ id: 18, name: "Drama" }],
      runtime: 120,
      credits: {
        crew: [{ job: "Director", name: "Fixture Director" }],
        cast: [{ name: "Fixture Actor" }],
      },
      keywords: { keywords: [{ name: "fixture" }] },
    });
  return Response.json({ results: [] });
});

beforeAll(() => {
  vi.stubEnv("TMDB_API_KEY", "test-key");
  vi.stubGlobal("fetch", fetchMock);
});

beforeEach(() => {
  fetchMock.mockClear();
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("TMDB server behavior", () => {
  it("caches search results for repeated queries", async () => {
    await searchTmdb("cache-test-phase-two");
    await searchTmdb("cache-test-phase-two");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps upstream rate limits to a useful error", async () => {
    await expect(searchTmdb("rate-limit-phase-two")).rejects.toMatchObject({
      status: 429,
      message: "TMDB rate limit reached. Try again shortly.",
    });
  });

  it("fetches and maps trending movies", async () => {
    const page = await getTmdbTrending("week");
    expect(page.results[0]).toMatchObject({
      id: 101,
      title: "Test Film",
      genres: ["Drama"],
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/trending/movie/week",
    );
  });

  it("serializes discover filters", async () => {
    await discoverTmdbMovies({
      sortBy: "vote_average.desc",
      voteCountGte: 200,
      withGenres: [18, 878],
      withCrew: [42],
    });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe("/3/discover/movie");
    expect(url.searchParams.get("vote_count.gte")).toBe("200");
    expect(url.searchParams.get("with_genres")).toBe("18,878");
    expect(url.searchParams.get("with_crew")).toBe("42");
  });

  it("fetches recommendations and similar movies", async () => {
    const [recommended, similar] = await Promise.all([
      getTmdbRecommendations(11),
      getTmdbSimilar(11),
    ]);
    expect(recommended.results).toHaveLength(1);
    expect(similar.results).toHaveLength(1);
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual(
      expect.arrayContaining([
        expect.stringContaining("/movie/11/recommendations"),
        expect.stringContaining("/movie/11/similar"),
      ]),
    );
  });

  it("fetches enriched details and videos", async () => {
    const [movie, videos] = await Promise.all([
      getTmdbMovie(101),
      getTmdbVideos(101),
    ]);
    expect(movie).toMatchObject({
      director: "Fixture Director",
      keywords: ["fixture"],
      cast: ["Fixture Actor"],
    });
    expect(videos[0]).toMatchObject({
      key: "youtube-key",
      type: "Trailer",
    });
    const detailUrl = fetchMock.mock.calls
      .map(([input]) => new URL(String(input)))
      .find(({ pathname }) => pathname === "/3/movie/101");
    expect(detailUrl?.searchParams.get("append_to_response")).toBe(
      "credits,keywords",
    );
  });

  it("resolves director names to TMDB person ids", async () => {
    await expect(searchTmdbPerson("Fixture Director")).resolves.toEqual([
      expect.objectContaining({ id: 42, knownForDepartment: "Directing" }),
    ]);
  });
});
