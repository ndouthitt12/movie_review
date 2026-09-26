import { describe, expect, it, vi } from "vitest";

// A guest has no session, so the guard returns the real 401 response.
vi.mock("@/lib/admin-auth", async () => {
  const { NextResponse } = await import("next/server");
  return {
    requireAdminApi: async () =>
      NextResponse.json({ error: "Log in to make changes." }, { status: 401 }),
  };
});
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
// Any database use means a guest request got past the guard.
vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    {
      get() {
        throw new Error("A guest request reached the database.");
      },
    },
  ),
}));

type Handler = (request: Request, context: never) => Promise<Response>;

const params = (values: Record<string, string>) =>
  ({ params: Promise.resolve(values) }) as never;

const cases: Array<
  [string, string, () => Promise<Record<string, unknown>>, never?]
> = [
  ["PUT", "/api/admin/display", () => import("@/app/api/admin/display/route")],
  ["POST", "/api/films", () => import("@/app/api/films/route")],
  [
    "PATCH",
    "/api/films/reorder",
    () => import("@/app/api/films/reorder/route"),
  ],
  [
    "PATCH",
    "/api/films/1",
    () => import("@/app/api/films/[id]/route"),
    params({ id: "1" }),
  ],
  [
    "PUT",
    "/api/films/1/rating",
    () => import("@/app/api/films/[id]/rating/route"),
    params({ id: "1" }),
  ],
  [
    "POST",
    "/api/films/1/watches",
    () => import("@/app/api/films/[id]/watches/route"),
    params({ id: "1" }),
  ],
  [
    "PATCH",
    "/api/films/1/watches/1",
    () => import("@/app/api/films/[id]/watches/[watchId]/route"),
    params({ id: "1", watchId: "1" }),
  ],
  [
    "DELETE",
    "/api/films/1/watches/1",
    () => import("@/app/api/films/[id]/watches/[watchId]/route"),
    params({ id: "1", watchId: "1" }),
  ],
  ["POST", "/api/rca-tags", () => import("@/app/api/rca-tags/route")],
  [
    "POST",
    "/api/rca-tags/merge",
    () => import("@/app/api/rca-tags/merge/route"),
  ],
  [
    "PUT",
    "/api/rca-tags/reorder",
    () => import("@/app/api/rca-tags/reorder/route"),
  ],
  [
    "PATCH",
    "/api/rca-tags/1",
    () => import("@/app/api/rca-tags/[id]/route"),
    params({ id: "1" }),
  ],
  [
    "DELETE",
    "/api/rca-tags/1",
    () => import("@/app/api/rca-tags/[id]/route"),
    params({ id: "1" }),
  ],
];

describe("routes that change data", () => {
  it.each(cases)(
    "%s %s refuses a guest",
    async (method, path, load, context) => {
      const handler = (await load())[method] as Handler;
      const response = await handler(
        new Request(`http://localhost${path}`, {
          method,
          headers: { "content-type": "application/json" },
          body: method === "DELETE" ? undefined : "{}",
        }),
        context as never,
      );
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        error: "Log in to make changes.",
      });
    },
  );
});
