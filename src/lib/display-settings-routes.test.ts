import { beforeAll, describe, expect, it, vi } from "vitest";
import { resetTestDatabase } from "@/test/database";

// These tests cover the logged-in owner. owner-auth-routes.test.ts covers guests.
vi.mock("@/lib/admin-auth", () => ({ requireAdminApi: async () => null }));

let saveDisplay: typeof import("@/app/api/admin/display/route").PUT;
let getScoreScale: typeof import("@/lib/score-scale").getScoreScale;

beforeAll(async () => {
  await resetTestDatabase();
  saveDisplay = (await import("@/app/api/admin/display/route")).PUT;
  getScoreScale = (await import("@/lib/score-scale")).getScoreScale;
});

function put(body: unknown) {
  return saveDisplay(
    new Request("http://test/api/admin/display", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("display settings", () => {
  it("shows scores out of 5 before anything is saved", async () => {
    expect(await getScoreScale()).toBe(5);
  });

  it("saves the 10-point scale and switches back", async () => {
    let response = await put({ scoreScale: 10 });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ scoreScale: 10 });
    expect(await getScoreScale()).toBe(10);

    response = await put({ scoreScale: 5 });
    expect(response.status).toBe(200);
    expect(await getScoreScale()).toBe(5);
  });

  it("refuses any other scale", async () => {
    for (const body of [{ scoreScale: 7 }, { scoreScale: "10" }, {}]) {
      const response = await put(body);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "Choose a scale of 5 or 10.",
      });
    }
    expect(await getScoreScale()).toBe(5);
  });
});
