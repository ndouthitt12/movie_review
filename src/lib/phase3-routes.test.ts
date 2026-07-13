import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { defaultRubric, starterRcaTags } from "@/db/seed-data";
import { rcaAttributes } from "@/db/schema";

let directory: string;
let sqlite: import("better-sqlite3").Database;
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
let updateRubric: (request: Request) => Promise<Response>;

beforeAll(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "picture-house-phase3-"));
  process.env.DATABASE_URL = path.join(directory, "routes.sqlite");
  const database = await import("@/db");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  migrate(database.db, { migrationsFolder: path.resolve("drizzle") });
  sqlite = database.sqlite;
  sqlite
    .prepare("insert into settings (id, weights, rubric) values (1, ?, ?)")
    .run(
      JSON.stringify({
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
      }),
      "[]",
    );
  sqlite
    .prepare(
      "insert into films (title, release_year, status) values ('Arrival', 2016, 'watched')",
    )
    .run();
  const collection = await import("@/app/api/rca-tags/route");
  createTag = collection.POST;
  listTags = collection.GET;
  const item = await import("@/app/api/rca-tags/[id]/route");
  updateTag = item.PATCH;
  deleteTag = item.DELETE;
  mergeTags = (await import("@/app/api/rca-tags/merge/route")).POST;
  saveRating = (await import("@/app/api/films/[id]/rating/route")).PUT;
  updateRubric = (await import("@/app/api/settings/rubric/route")).PUT;
});

afterAll(async () => {
  sqlite?.close();
  if (directory) await fs.rm(directory, { recursive: true, force: true });
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
      attribute: "impact",
      polarity: "positive",
      color: null,
    });
    expect(sourceResponse.status).toBe(201);
    const source = (await sourceResponse.json()) as { id: number };
    const duplicate = await postTag({
      label: "emotional ENDING",
      attribute: "impact",
      polarity: "negative",
      color: null,
    });
    expect(duplicate.status).toBe(409);
    const targetResponse = await postTag({
      label: "Emotionally resonant",
      attribute: "impact",
      polarity: "positive",
      color: "#00e054",
    });
    const target = (await targetResponse.json()) as { id: number };

    const duplicateRename = await updateTag(
      jsonRequest(`http://test/api/rca-tags/${source.id}`, "PATCH", {
        label: "EMOTIONALLY RESONANT",
      }),
      { params: Promise.resolve({ id: String(source.id) }) },
    );
    expect(duplicateRename.status).toBe(409);

    const rating = await saveRating(
      jsonRequest("http://test/api/films/1/rating", "PUT", {
        story: 90,
        direction: 89,
        writing: 88,
        acting: 87,
        music: 86,
        impact: 95,
        rewatchability: 85,
        genreFit: 92,
        quality: 90,
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
      sqlite
        .prepare("select rca_tag_id from film_rca_tags where film_id = 1")
        .all(),
    ).toEqual([{ rca_tag_id: target.id }]);

    const invalidRating = await saveRating(
      jsonRequest("http://test/api/films/1/rating", "PUT", {
        story: 10,
        direction: 10,
        writing: 10,
        acting: 10,
        music: 10,
        impact: 10,
        rewatchability: 10,
        genreFit: 10,
        quality: 10,
        rcaTagIds: [999999],
      }),
      { params: Promise.resolve({ id: "1" }) },
    );
    expect(invalidRating.status).toBe(409);
    expect(
      sqlite.prepare("select impact from ratings where film_id = 1").get(),
    ).toEqual({ impact: 95 });

    const deleted = await deleteTag(
      new Request(`http://test/api/rca-tags/${target.id}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: String(target.id) }) },
    );
    expect(await deleted.json()).toEqual({ deleted: true, usageCount: 1 });
    expect(
      sqlite.prepare("select count(*) as count from film_rca_tags").get(),
    ).toEqual({ count: 0 });
  });
});

describe("Phase 4 rubric integration", () => {
  it("validates and persists all eleven rubric levels", async () => {
    const invalid = await updateRubric(
      jsonRequest("http://test/api/settings/rubric", "PUT", {
        rubric: defaultRubric.slice(0, 10),
      }),
    );
    expect(invalid.status).toBe(400);

    const rubric = defaultRubric.map((row) =>
      row.score === 7
        ? { ...row, meaning: "A personal favorite", examples: ["Arrival"] }
        : row,
    );
    const response = await updateRubric(
      jsonRequest("http://test/api/settings/rubric", "PUT", { rubric }),
    );
    expect(response.status).toBe(200);
    expect(
      JSON.parse(
        (
          sqlite.prepare("select rubric from settings where id = 1").get() as {
            rubric: string;
          }
        ).rubric,
      ).find((row: { score: number }) => row.score === 7),
    ).toEqual({
      score: 7,
      meaning: "A personal favorite",
      examples: ["Arrival"],
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
