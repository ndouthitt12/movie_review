import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { searchTmdb } from "./tmdb-server";

const fetchMock = vi.fn(async (input: string | URL | Request) => {
  const url = String(input);
  if (url.includes("rate-limit"))
    return new Response(JSON.stringify({ status_message: "rate limited" }), {
      status: 429,
    });
  return new Response(JSON.stringify({ results: [] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});

beforeAll(() => {
  vi.stubEnv("TMDB_API_KEY", "test-key");
  vi.stubGlobal("fetch", fetchMock);
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("TMDB server behavior", () => {
  it("caches search results for repeated queries", async () => {
    await searchTmdb("cache-test");
    await searchTmdb("cache-test");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps upstream rate limits to a useful error", async () => {
    await expect(searchTmdb("rate-limit")).rejects.toMatchObject({
      status: 429,
      message: "TMDB rate limit reached. Try again shortly.",
    });
  });
});
