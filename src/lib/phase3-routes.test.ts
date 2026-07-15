import { beforeAll, describe, expect, it, vi } from "vitest";
import { defaultRubric, starterRcaTags } from "@/db/seed-data";
import { films, rcaAttributes, settings } from "@/db/schema";
import { queryRow, queryRows, resetTestDatabase } from "@/test/database";

let createTag: (request: Request) => Promise<Response>;
let listTags: () => Promise<Response>;
let updateTag: (
  request: Request,
  context: { params: Promise<{ id: string }> },
) => Promise<Response>;
let deleteTag: (
  request: Request,
  context: { params: Promise<{ id: string }> },
) => Promise<Response>;
let mergeTags: (request: Request) => Promise<Response>;
let saveRating: (
  request: Request,
  context: { params: Promise<{ id: string }> },
) => Promise<Response>;
let updateScale: (request: Request) => Promise<Response>;

vi.mock("@/lib/admin-auth", () => ({ requireAdminApi: async () => null }));

beforeAll(async () => {
  const database = await import("@/db");
  await resetTestDatabase();
  await (await import("../../scripts/seed")).seedDatabase(database.db);
  await database.db.insert(settings).values({
    id: 1,
    weights: {
      story: 5,
      direction: 5,
      writing: 5,
      acting: 5,
      music: 2,
      impact: 4,
      rewatchability: 10,
      rewatchabilityOffset: -50,
      genreFit: 3,
      divisor: 334,
    },
    rubric: defaultRubric,
  });
  await database.db.insert(films).values({
    title: "Arrival",
    releaseYear: 2016,
    status: "watched",
  });
  const collection = await import("@/app/api/rca-tags/route");
  createTag = collection.POST;
  listTags = collection.GET;
  const item = await import("@/app/api/rca-tags/[id]/route");
  updateTag = item.PATCH;
  deleteTag = item.DELETE;
  mergeTags = (await import("@/app/api/rca-tags/merge/route")).POST;
  saveRating = (await import("@/app/api/films/[id]/rating/route")).PUT;
  updateScale = (await import("@/app/api/admin/scale/route")).PUT;
});

describe("Phase 3 RCA integration", () => {
  it("provides at least four starter tags for every attribute", () => {
    for (const attribute of rcaAttributes)
      expect(
        starterRcaTags.filter(([value]) => value === attribute).length,
      ).toBeGreaterThanOrEqual(4);
  });

  it("creates, counts, renames, merges, persists, and cascade-deletes tags", async () => {
    const sourceResponse = await postTag({
      label: "Emotional ending",
      questionKey: "impact",
      polarity: "positive",
      color: null,
    });
    expect(sourceResponse.status).toBe(201);
    const source = (await sourceResponse.json()) as { id: number };
    const duplicate = await postTag({
      label: "emotional ENDING",
      questionKey: "impact",
      polarity: "negative",
      color: null,
    });
    expect(duplicate.status).toBe(409);
    const targetResponse = await postTag({
      label: "Deeply moving",
      questionKey: "impact",
      polarity: "positive",
      color: "#00e054",
    });
    const target = (await targetResponse.json()) as { id: number };

    const duplicateRename = await updateTag(
      jsonRequest(`http://test/api/rca-tags/${source.id}`, "PATCH", {
        label: "DEEPLY MOVING",
      }),
      { params: Promise.resolve({ id: String(source.id) }) },
    );
    expect(duplicateRename.status).toBe(409);

    const rating = await saveRating(
      jsonRequest("http://test/api/films/1/rating", "PUT", {
        formVersionId: 1,
        answers: (
          await queryRows<{ id: number; key: string }>(
            "select id, key from questions where form_version_id = 1",
          )
        ).map(({ id, key }) => ({
          questionId: id,
          valueNumber:
            key === "impact" ? 95 : key === "rewatchability" ? 85 : 90,
        })),
        rcaTagIds: [source.id],
      }),
      { params: Promise.resolve({ id: "1" }) },
    );
    expect(rating.status).toBe(200);
    const listed = (await (await listTags()).json()) as {
      tags: Array<{ id: number; usageCount: number }>;
    };
    expect(listed.tags.find(({ id }) => id === source.id)?.usageCount).toBe(1);

    const renamed = await updateTag(
      jsonRequest(`http://test/api/rca-tags/${source.id}`, "PATCH", {
        label: "Powerful ending",
        polarity: "neutral",
        color: "#123456",
      }),
      { params: Promise.resolve({ id: String(source.id) }) },
    );
    expect(renamed.status).toBe(200);
    expect(await renamed.json()).toMatchObject({
      label: "Powerful ending",
      polarity: "neutral",
      color: "#123456",
    });
    const merged = await mergeTags(
      jsonRequest("http://test/api/rca-tags/merge", "POST", {
        sourceId: source.id,
        targetId: target.id,
      }),
    );
    expect(merged.status).toBe(200);
    expect(
      await queryRows("select rca_tag_id from film_rca_tags where film_id = 1"),
    ).toEqual([{ rca_tag_id: target.id }]);

    const invalidRating = await saveRating(
      jsonRequest("http://test/api/films/1/rating", "PUT", {
        formVersionId: 1,
        answers: (
          await queryRows<{ id: number }>(
            "select id from questions where form_version_id = 1",
          )
        ).map(({ id }) => ({ questionId: id, valueNumber: 10 })),
        rcaTagIds: [999999],
      }),
      { params: Promise.resolve({ id: "1" }) },
    );
    expect(invalidRating.status).toBe(409);
    expect(
      await queryRow(
        `select answers.value_number as impact
         from answers join questions on questions.id = answers.question_id
         where answers.film_id = 1 and questions.key = 'impact'`,
      ),
    ).toEqual({ impact: 95 });

    const deleted = await deleteTag(
      new Request(`http://test/api/rca-tags/${target.id}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: String(target.id) }) },
    );
    expect(await deleted.json()).toEqual({ deleted: true, usageCount: 1 });
    expect(
      await queryRow("select count(*)::int as count from film_rca_tags"),
    ).toEqual({ count: 0 });
  });
});

describe("Phase 4 scale integration", () => {
  it("validates and persists all eleven scale levels", async () => {
    const levels = defaultRubric.map((row) => ({
      level: row.score,
      title: "",
      meaning: row.meaning,
      exampleFilms: row.examples.join(", "),
    }));
    const invalid = await updateScale(
      jsonRequest("http://test/api/admin/scale", "PUT", {
        levels: levels.slice(0, 10),
      }),
    );
    expect(invalid.status).toBe(400);

    const updated = levels.map((row) =>
      row.level === 7
        ? { ...row, meaning: "A personal favorite", exampleFilms: "Arrival" }
        : row,
    );
    const response = await updateScale(
      jsonRequest("http://test/api/admin/scale", "PUT", { levels: updated }),
    );
    expect(response.status).toBe(200);
    expect(
      await queryRow(
        'select level, title, meaning, example_films as "exampleFilms" from scale_levels where level = 7',
      ),
    ).toEqual({
      level: 7,
      title: "",
      meaning: "A personal favorite",
      exampleFilms: "Arrival",
    });
  });
});

function postTag(body: Record<string, unknown>) {
  return createTag(jsonRequest("http://test/api/rca-tags", "POST", body));
}

function jsonRequest(url: string, method: string, body: unknown) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
