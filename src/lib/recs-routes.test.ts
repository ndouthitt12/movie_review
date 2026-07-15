import { beforeEach, describe, expect, it, vi } from "vitest";

const { getRecommendations, getTrendingData } = vi.hoisted(() => ({
  getRecommendations: vi.fn(),
  getTrendingData: vi.fn(),
}));

vi.mock("@/lib/recs-server", () => ({
  getRecommendations,
  getTrending: getTrendingData,
}));

import { GET as getRecs } from "@/app/api/recs/route";
import { GET as getTrendingRoute } from "@/app/api/recs/trending/route";

beforeEach(() => {
  getRecommendations.mockResolvedValue({
    available: true,
    mode: "personalized",
    personalWeight: 1,
    generatedAt: "2026-07-15T00:00:00.000Z",
    items: [],
  });
  getTrendingData.mockResolvedValue({
    available: true,
    generatedAt: "2026-07-15T00:00:00.000Z",
    items: [],
  });
});

describe("recommendation API routes", () => {
  it("returns recommendations and forwards the requested limit", async () => {
    const response = await getRecs(
      new Request("http://test/api/recs?limit=8"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      available: true,
      mode: "personalized",
    });
    expect(getRecommendations).toHaveBeenCalledWith(8);
  });

  it("returns trending data and forwards the requested limit", async () => {
    const response = await getTrendingRoute(
      new Request("http://test/api/recs/trending?limit=16"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ available: true, items: [] });
    expect(getTrendingData).toHaveBeenCalledWith(16);
  });
});
