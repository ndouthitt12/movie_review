import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { films, formVersions, questions } from "@/db/schema";
import { resetTestDatabase } from "@/test/database";
import { seedDatabase } from "@/db/seed";
import { getCatalogOptions, getFilmDetail } from "./catalog";
import { ensureDraftForm } from "./admin-form";
import { getPublishedRuntimeForm, type RuntimeFormConfig } from "./form-config";
import { preparePublishedRecompute } from "./recompute";
import { POST as changeForm } from "@/app/api/admin/form/route";
import { POST as publish } from "@/app/api/admin/form/publish/route";
import { PUT as saveRating } from "@/app/api/films/[id]/rating/route";

vi.mock("@/lib/admin-auth", () => ({ requireAdminApi: async () => null }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), cacheTag: vi.fn() }));

function request(body: unknown) {
  return new Request("http://test/api/admin/form", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

let filmRows: Array<typeof films.$inferSelect>;

beforeAll(async () => {
  await resetTestDatabase();
  await seedDatabase(db);
  filmRows = await db
    .insert(films)
    .values([
      {
        title: "Drama only",
        releaseYear: 2020,
        status: "watched",
        genrePrimary: "Drama",
      },
      {
        title: "Horror film",
        releaseYear: 2021,
        status: "watched",
        genrePrimary: "Drama",
        genreSecondary: "Horror",
      },
      {
        title: "Comedy film",
        releaseYear: 2022,
        status: "watched",
        tmdbGenres: ["Comedy", "Science Fiction"],
      },
      {
        title: "Horror comedy",
        releaseYear: 2023,
        status: "watched",
        genrePrimary: "Horror",
        tmdbGenres: ["Comedy", "Horror", "Sci-Fi"],
      },
    ])
    .returning();
});

describe("genre question workflow", () => {
  it("offers the genres used anywhere in the database", async () => {
    expect((await getCatalogOptions()).genres).toEqual([
      "Comedy",
      "Drama",
      "Horror",
      "Sci-Fi",
    ]);
  });

  it("creates, publishes, clones, validates and scores every matching genre attribute", async () => {
    const draft = await ensureDraftForm();
    await db
      .update(questions)
      .set({ required: false, scored: false, secondaryScored: false })
      .where(eq(questions.formVersionId, draft.id));
    await db
      .update(formVersions)
      .set({ manualDivisor: 40, secondaryManualDivisor: 80 })
      .where(eq(formVersions.id, draft.id));
    for (const [key, label, applicableGenres] of [
      ["craft", "Craft", []],
      ["fear", "How scary or unsettling?", ["Horror"]],
      ["humor", "How funny?", ["Comedy"]],
      ["genre_effect", "Genre effect", ["Horror", "Comedy"]],
    ] as const) {
      const response = await changeForm(
        request({
          action: "add_question",
          data: {
            key,
            label,
            applicableGenres,
            type: "slider",
            required: true,
            scored: true,
            weight: 1,
            secondaryScored: true,
            secondaryWeight: 2,
            blankPolicy: "treat_as_zero",
            secondaryBlankPolicy: "treat_as_zero",
          },
        }),
      );
      expect(response.status).toBe(200);
    }
    expect((await publish()).status).toBe(200);
    const form = (await getPublishedRuntimeForm())!;
    const byKey = new Map(form.questions.map((q) => [q.key, q]));
    const cloned = await ensureDraftForm();
    expect(
      cloned.questions.find((q) => q.key === "fear")?.applicableGenres,
    ).toEqual(["Horror"]);
    expect(
      cloned.questions.find((q) => q.key === "genre_effect")?.applicableGenres,
    ).toEqual(["Comedy", "Horror"]);

    const values = { craft: 80, fear: 60, humor: 90, genre_effect: 70 };
    async function rate(index: number, keys: Array<keyof typeof values>) {
      return saveRating(
        request({
          formVersionId: form.id,
          answers: keys.map((key) => ({
            questionId: byKey.get(key)!.id,
            valueNumber: values[key],
          })),
          rcaTagIds: [],
          genres: ["Horror", "Comedy"], // Client genre claims must be ignored.
        }),
        { params: Promise.resolve({ id: String(filmRows[index].id) }) },
      );
    }
    const missing = await rate(3, ["craft", "fear"]);
    expect(missing.status).toBe(400);
    expect((await missing.json()).error).toContain("How funny?");

    for (const [index, keys, overall] of [
      [0, ["craft"], 8],
      [1, ["craft", "fear", "genre_effect"], 7],
      [2, ["craft", "humor", "genre_effect"], 8],
      [3, ["craft", "fear", "humor", "genre_effect"], 7.5],
    ] as const) {
      const response = await rate(index, [...keys]);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        overall,
        secondary: overall,
      });
      const detail = (await getFilmDetail(filmRows[index].id))!;
      expect(detail.film.title).toBe(filmRows[index].title);
      expect(detail.rating?.overall).toBe(overall);
    }
    // Stored answers for an inapplicable attribute are retained but never counted.
    expect(
      await (await rate(0, ["craft", "fear", "humor", "genre_effect"])).json(),
    ).toMatchObject({ overall: 8, secondary: 8 });
    const recompute = await preparePublishedRecompute();
    expect(recompute.rows.map((row) => row.after)).toEqual(
      recompute.rows.map((row) => row.before),
    );
    expect(recompute.rows.map((row) => row.secondaryAfter)).toEqual(
      recompute.rows.map((row) => row.secondaryBefore),
    );

    const target = cloned.questions.find((q) => q.key === "fear")!;
    const changed = await changeForm(
      request({
        action: "update_question",
        questionId: target.id,
        data: { applicableGenres: ["Comedy"] },
      }),
    );
    expect(changed.status).toBe(200);
    expect(
      ((await changed.json()).form as RuntimeFormConfig).questions.find(
        (q) => q.key === "fear",
      )?.applicableGenres,
    ).toEqual(["Comedy"]);
    expect(
      (await getPublishedRuntimeForm())!.questions.find((q) => q.key === "fear")
        ?.applicableGenres,
    ).toEqual(["Horror"]);
    const invalid = await changeForm(
      request({
        action: "update_question",
        questionId: target.id,
        data: { applicableGenres: [" "] },
      }),
    );
    expect(invalid.status).toBe(400);
    const cleared = await changeForm(
      request({
        action: "update_question",
        questionId: target.id,
        data: { applicableGenres: [] },
      }),
    );
    expect(cleared.status).toBe(200);
    expect(
      ((await cleared.json()).form as RuntimeFormConfig).questions.find(
        (q) => q.key === "fear",
      )?.applicableGenres,
    ).toEqual([]);
  });
});
