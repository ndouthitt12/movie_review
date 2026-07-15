import { beforeAll, describe, expect, it } from "vitest";
import { defaultRubric } from "@/db/seed-data";
import { settings } from "@/db/schema";
import { queryRow, queryRows, resetTestDatabase } from "@/test/database";

let createFilm: (request: Request) => Promise<Response>;
let reorderFilms: (request: Request) => Promise<Response>;
let saveRating: (
  request: Request,
  context: { params: Promise<{ id: string }> },
) => Promise<Response>;
let addWatch: (
  request: Request,
  context: { params: Promise<{ id: string }> },
) => Promise<Response>;
let editWatch: (
  request: Request,
  context: { params: Promise<{ id: string; watchId: string }> },
) => Promise<Response>;
let deleteWatch: (
  request: Request,
  context: { params: Promise<{ id: string; watchId: string }> },
) => Promise<Response>;

beforeAll(async () => {
  const database = await import("@/db");
  await resetTestDatabase();
  await (await import("@/db/seed")).seedDatabase(database.db);
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
  createFilm = (await import("@/app/api/films/route")).POST;
  reorderFilms = (await import("@/app/api/films/reorder/route")).PATCH;
  saveRating = (await import("@/app/api/films/[id]/rating/route")).PUT;
  addWatch = (await import("@/app/api/films/[id]/watches/route")).POST;
  const watchRoute =
    await import("@/app/api/films/[id]/watches/[watchId]/route");
  editWatch = watchRoute.PATCH;
  deleteWatch = watchRoute.DELETE;
});

describe("Phase 2 route integration", () => {
  it("guards duplicates and orphan franchises, validates complete reorder, and synchronizes rating watches", async () => {
    const first = await postFilm({
      title: "Arrival",
      releaseYear: 2016,
      status: "to_watch",
      franchiseName: "First Contact",
      tmdbGenres: [],
    });
    expect(first.status).toBe(201);
    const { id: firstId } = (await first.json()) as { id: number };

    const crossSourceDuplicate = await postFilm({
      tmdbId: 329865,
      title: "Arrival",
      releaseYear: 2016,
      status: "watched",
      franchiseName: "Should Not Persist",
      tmdbGenres: ["Science Fiction"],
    });
    expect(crossSourceDuplicate.status).toBe(409);
    expect(
      await queryRow("select count(*)::int as count from franchises"),
    ).toEqual({ count: 1 });

    const second = await postFilm({
      title: "Primer",
      releaseYear: 2004,
      status: "to_watch",
      tmdbGenres: [],
    });
    const { id: secondId } = (await second.json()) as { id: number };
    const partialReorder = await reorderFilms(
      jsonRequest("http://test/api/films/reorder", "PATCH", {
        filmIds: [secondId],
      }),
    );
    expect(partialReorder.status).toBe(409);
    const before = await queryRows<{ id: number; watch_order: number }>(
      "select id, watch_order from films where status = 'to_watch' order by id",
    );
    expect(
      new Set(before.map((row) => (row as { watch_order: number }).watch_order))
        .size,
    ).toBe(2);

    const completeReorder = await reorderFilms(
      jsonRequest("http://test/api/films/reorder", "PATCH", {
        filmIds: [secondId, firstId],
      }),
    );
    expect(completeReorder.status).toBe(200);
    expect(
      await queryRows(
        "select id from films where status = 'to_watch' order by watch_order",
      ),
    ).toEqual([{ id: secondId }, { id: firstId }]);

    const questionRows = await queryRows<{ id: number; key: string }>(
      "select id, key from questions where form_version_id = 1",
    );
    const answers = questionRows.map(({ id }) => ({
      questionId: id,
      valueNumber: 90,
    }));
    const rating = await saveRating(
      jsonRequest(`http://test/api/films/${firstId}/rating`, "PUT", {
        formVersionId: 1,
        answers,
        promoteToWatched: true,
        watchedOn: "2026-07-12",
      }),
      { params: Promise.resolve({ id: String(firstId) }) },
    );
    expect(rating.status).toBe(200);
    expect(
      await queryRow(
        "select status, last_watch_date from films where id = $1",
        [firstId],
      ),
    ).toEqual({ status: "watched", last_watch_date: "2026-07-12" });

    const story = questionRows.find(({ key }) => key === "story")!;
    const updatedRating = await saveRating(
      jsonRequest(`http://test/api/films/${firstId}/rating`, "PUT", {
        formVersionId: 1,
        answers: answers.map((answer) =>
          answer.questionId === story.id
            ? { ...answer, valueNumber: 80 }
            : answer,
        ),
      }),
      { params: Promise.resolve({ id: String(firstId) }) },
    );
    expect(updatedRating.status).toBe(200);
    expect(
      await queryRow("select count(*)::int as count from ratings"),
    ).toEqual({ count: 1 });
    expect(
      await queryRow(
        "select value_number as value from answers where film_id = $1 and question_id = $2",
        [firstId, story.id],
      ),
    ).toEqual({ value: 80 });

    const invalidRating = await saveRating(
      jsonRequest(`http://test/api/films/${firstId}/rating`, "PUT", {
        formVersionId: 1,
        answers: answers.map((answer) =>
          answer.questionId === story.id
            ? { ...answer, valueNumber: 101 }
            : answer,
        ),
      }),
      { params: Promise.resolve({ id: String(firstId) }) },
    );
    expect(invalidRating.status).toBe(400);
    expect(
      await queryRow(
        "select value_number as value from answers where film_id = $1 and question_id = $2",
        [firstId, story.id],
      ),
    ).toEqual({ value: 80 });

    const added = await addWatch(
      jsonRequest(`http://test/api/films/${firstId}/watches`, "POST", {
        watchedOn: "2026-07-10",
        isRewatch: true,
      }),
      { params: Promise.resolve({ id: String(firstId) }) },
    );
    const { id: watchId } = (await added.json()) as { id: number };
    await editWatch(
      jsonRequest(
        `http://test/api/films/${firstId}/watches/${watchId}`,
        "PATCH",
        { watchedOn: "2026-07-15", isRewatch: true },
      ),
      {
        params: Promise.resolve({
          id: String(firstId),
          watchId: String(watchId),
        }),
      },
    );
    expect(
      await queryRow("select last_watch_date from films where id = $1", [
        firstId,
      ]),
    ).toEqual({ last_watch_date: "2026-07-15" });
    await deleteWatch(
      new Request(`http://test/api/films/${firstId}/watches/${watchId}`, {
        method: "DELETE",
      }),
      {
        params: Promise.resolve({
          id: String(firstId),
          watchId: String(watchId),
        }),
      },
    );
    expect(
      await queryRow("select last_watch_date from films where id = $1", [
        firstId,
      ]),
    ).toEqual({ last_watch_date: "2026-07-12" });
  });
});

function postFilm(body: Record<string, unknown>) {
  return createFilm(jsonRequest("http://test/api/films", "POST", body));
}

function jsonRequest(url: string, method: string, body: unknown) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
