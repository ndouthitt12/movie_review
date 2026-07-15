import { beforeAll, describe, expect, it, vi } from "vitest";
import { defaultRubric } from "@/db/seed-data";
import { settings } from "@/db/schema";
import { queryRow, resetTestDatabase } from "@/test/database";

vi.mock("@/lib/admin-auth", () => ({ requireAdminApi: async () => null }));

let formRoute: typeof import("@/app/api/admin/form/route");
let publish: typeof import("@/app/api/admin/form/publish/route").POST;
let saveRating: typeof import("@/app/api/films/[id]/rating/route").PUT;
let createFilm: typeof import("@/app/api/films/route").POST;
type RouteAnswer = {
  questionId: number;
  valueNumber?: number;
  valueText?: string;
  valueOptionIds?: number[];
};

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
  formRoute = await import("@/app/api/admin/form/route");
  publish = (await import("@/app/api/admin/form/publish/route")).POST;
  saveRating = (await import("@/app/api/films/[id]/rating/route")).PUT;
  createFilm = (await import("@/app/api/films/route")).POST;
});

describe("admin form workflow", () => {
  it("creates, conditions, reorders, publishes, rates, and itemizes a scored dropdown", async () => {
    const createdFilm = await createFilm(
      jsonRequest("http://test/api/films", "POST", {
        tmdbId: 329865,
        title: "Arrival",
        releaseYear: 2016,
        status: "watched",
        director: "Denis Villeneuve",
        overview: "A linguist meets visitors.",
        tmdbGenres: ["Science Fiction"],
      }),
    );
    expect(createdFilm.status).toBe(201);
    const draft = (await (await formRoute.GET()).json()) as {
      form: {
        id: number;
        sections: Array<{ id: number }>;
        questions: Array<{ id: number }>;
      };
    };
    const sectionId = draft.form.sections[0]!.id;
    let response = await change({
      action: "add_question",
      data: {
        key: "watch_again",
        label: "Would you watch this film again?",
        type: "dropdown",
        sectionId,
        required: true,
        scored: true,
        weight: 2,
      },
    });
    expect(response.status).toBe(200);
    let body = (await response.json()) as {
      form: {
        questions: Array<{
          id: number;
          key: string;
          options: Array<{ id: number; label: string }>;
        }>;
      };
    };
    const dropdown = body.form.questions.find(
      ({ key }) => key === "watch_again",
    )!;
    response = await change({
      action: "add_options",
      questionId: dropdown.id,
      labels: ["Theater", "Streaming", "Physical media"],
    });
    expect(response.status).toBe(200);
    body = await response.json();
    dropdown.options = body.form.questions.find(
      ({ key }) => key === "watch_again",
    )!.options;
    expect(dropdown.options.map(({ label }) => label)).toEqual([
      "Theater",
      "Streaming",
      "Physical media",
    ]);
    for (const [label, score, isNull] of [
      ["Absolutely", 100, false],
      ["Maybe someday", 50, false],
      ["Never again", 0, false],
      ["N/A", null, true],
    ] as const) {
      response = await change({
        action: "save_option",
        questionId: dropdown.id,
        data: {
          label,
          valueScore: score,
          isNull,
          sortOrder: dropdown.options.length * 10 + 10,
        },
      });
      expect(response.status).toBe(200);
      body = await response.json();
      dropdown.options = body.form.questions.find(
        ({ key }) => key === "watch_again",
      )!.options;
    }
    response = await change({
      action: "add_question",
      data: {
        key: "never_again_reason",
        label: "Why would you never watch it again?",
        type: "paragraph",
        sectionId,
      },
    });
    body = await response.json();
    const paragraph = body.form.questions.find(
      ({ key }) => key === "never_again_reason",
    )!;
    const never = dropdown.options.find(
      ({ label }) => label === "Never again",
    )!;
    response = await change({
      action: "add_condition",
      questionId: paragraph.id,
      data: {
        sourceQuestionId: dropdown.id,
        operator: "equals",
        value: never.id,
        effect: "show",
      },
    });
    expect(response.status).toBe(200);

    const current = (await response.json()) as typeof body;
    const ids = current.form.questions.map(({ id }) => id);
    const invalidOrder = [
      paragraph.id,
      ...ids.filter((id) => id !== paragraph.id && id !== dropdown.id),
      dropdown.id,
    ];
    const invalid = await change({
      action: "reorder",
      orderedIds: invalidOrder,
    });
    expect(invalid.status).toBe(400);
    expect((await invalid.json()) as { error: string }).toMatchObject({
      error: expect.stringContaining("condition source"),
    });

    const publishedResponse = await publish();
    expect(publishedResponse.status).toBe(200);
    const published = (await publishedResponse.json()) as {
      form: {
        id: number;
        questions: Array<{
          id: number;
          key: string;
          type: string;
          options: Array<{ id: number; label: string }>;
        }>;
      };
    };
    const publishedDropdown = published.form.questions.find(
      ({ key }) => key === "watch_again",
    )!;
    const publishedParagraph = published.form.questions.find(
      ({ key }) => key === "never_again_reason",
    )!;
    const publishedNever = publishedDropdown.options.find(
      ({ label }) => label === "Never again",
    )!;
    const publishedMaybe = publishedDropdown.options.find(
      ({ label }) => label === "Maybe someday",
    )!;
    const ratingAnswers: RouteAnswer[] =
      published.form.questions.flatMap<RouteAnswer>((question) =>
        question.id === publishedDropdown.id
          ? [{ questionId: question.id, valueOptionIds: [publishedMaybe.id] }]
          : question.id === publishedParagraph.id
            ? []
            : [{ questionId: question.id, valueNumber: 90 }],
      );

    const tagsRoute = await import("@/app/api/rca-tags/route");
    const mergeRoute = await import("@/app/api/rca-tags/merge/route");
    const tagItemRoute = await import("@/app/api/rca-tags/[id]/route");
    const sourceResponse = await tagsRoute.POST(
      jsonRequest("http://test/api/rca-tags", "POST", {
        label: "Would rewatch",
        questionKey: "watch_again",
        polarity: "positive",
        color: null,
      }),
    );
    const targetResponse = await tagsRoute.POST(
      jsonRequest("http://test/api/rca-tags", "POST", {
        label: "Replay value",
        questionKey: "watch_again",
        polarity: "positive",
        color: null,
      }),
    );
    const sourceTag = (await sourceResponse.json()) as { id: number };
    const targetTag = (await targetResponse.json()) as { id: number };

    const rated = await saveRating(
      jsonRequest("http://test/api/films/1/rating", "PUT", {
        formVersionId: published.form.id,
        answers: ratingAnswers,
        rcaTagIds: [sourceTag.id],
      }),
      { params: Promise.resolve({ id: "1" }) },
    );
    expect(rated.status).toBe(200);
    const { getPublishedRuntimeForm } = await import("./form-config");
    const { computeOverallFromForm, evaluateFormConditions } =
      await import("./scoring");
    const runtime = (await getPublishedRuntimeForm())!;
    const answerMap = Object.fromEntries(
      ratingAnswers.map((answer) => [
        answer.questionId,
        {
          number: answer.valueNumber,
          text: answer.valueText,
          optionIds: answer.valueOptionIds,
        },
      ]),
    );
    const scored = computeOverallFromForm(runtime, answerMap);
    expect(
      scored.terms.find(
        ({ questionId }) => questionId === publishedDropdown.id,
      ),
    ).toMatchObject({ counted: true, points: 100 });
    expect(
      evaluateFormConditions(runtime, {
        [publishedDropdown.id]: { optionIds: [publishedNever.id] },
      })[publishedParagraph.id].visible,
    ).toBe(true);
    expect(
      evaluateFormConditions(runtime, {
        [publishedDropdown.id]: { optionIds: [publishedMaybe.id] },
      })[publishedParagraph.id].visible,
    ).toBe(false);

    const dashboard = await import("./catalog");
    const dashboardBefore = await dashboard.getDashboardData();
    expect(dashboardBefore.attributes).toContainEqual({
      key: "watch_again",
      label: "Would you watch this film again?",
    });
    expect(
      dashboardBefore.attributes.some(
        ({ key }) => key === "never_again_reason",
      ),
    ).toBe(false);
    expect(
      dashboardBefore.films.find(({ id }) => id === 1)?.rating?.values
        .watch_again,
    ).toBe(50);
    expect(
      dashboardBefore.films.find(({ id }) => id === 1)?.rcaTags,
    ).toContainEqual(expect.objectContaining({ questionKey: "watch_again" }));

    const merged = await mergeRoute.POST(
      jsonRequest("http://test/api/rca-tags/merge", "POST", {
        sourceId: sourceTag.id,
        targetId: targetTag.id,
      }),
    );
    expect(merged.status).toBe(200);
    const listed = (await (await tagsRoute.GET()).json()) as {
      tags: Array<{ id: number; usageCount: number }>;
    };
    expect(listed.tags.find(({ id }) => id === targetTag.id)?.usageCount).toBe(
      1,
    );

    const exportRoute = await import("@/app/api/admin/export/route");
    const jsonExport = await exportRoute.GET(
      new Request("http://test/api/admin/export?format=json"),
    );
    const exported = (await jsonExport.json()) as {
      form_versions: unknown[];
      questions: Array<{ key: string }>;
      question_options: unknown[];
      question_conditions: unknown[];
      answers: unknown[];
      scale_levels: unknown[];
    };
    expect(exported.form_versions.length).toBeGreaterThanOrEqual(2);
    expect(exported.questions.some(({ key }) => key === "watch_again")).toBe(
      true,
    );
    expect(exported.question_options.length).toBeGreaterThanOrEqual(4);
    expect(exported.question_conditions.length).toBeGreaterThanOrEqual(1);
    expect(exported.answers.length).toBeGreaterThanOrEqual(1);
    expect(exported.scale_levels).toHaveLength(11);
    const csvExport = await exportRoute.GET(
      new Request("http://test/api/admin/export?format=csv"),
    );
    const csv = await csvExport.text();
    expect(csv.split("\r\n")[0]).toContain("Would you watch this film again?");
    expect(csv).toContain("Maybe someday");

    const draftAfterPublish = (await (await formRoute.GET()).json()) as {
      form: {
        questions: Array<{
          id: number;
          key: string;
          options: Array<{ id: number; label: string; sortOrder: number }>;
        }>;
      };
    };
    const copiedDropdown = draftAfterPublish.form.questions.find(
      ({ key }) => key === "watch_again",
    )!;
    const copiedMaybe = copiedDropdown.options.find(
      ({ label }) => label === "Maybe someday",
    )!;
    const answerCountBeforeToggle = (await queryRow<{ count: number }>(
      "select count(*)::int as count from answers where film_id = 1",
    ))!.count;
    const toggledOff = (await (
      await change({
        action: "update_question",
        questionId: copiedDropdown.id,
        data: { scored: false },
      })
    ).json()) as {
      form: { questions: Array<{ id: number; scored: boolean }> };
    };
    expect(
      toggledOff.form.questions.find(({ id }) => id === copiedDropdown.id)
        ?.scored,
    ).toBe(false);
    const toggledOn = (await (
      await change({
        action: "update_question",
        questionId: copiedDropdown.id,
        data: { scored: true, weight: 2 },
      })
    ).json()) as {
      form: { questions: Array<{ id: number; scored: boolean }> };
    };
    expect(
      toggledOn.form.questions.find(({ id }) => id === copiedDropdown.id)
        ?.scored,
    ).toBe(true);
    expect(
      (await queryRow<{ count: number }>(
        "select count(*)::int as count from answers where film_id = 1",
      ))!.count,
    ).toBe(answerCountBeforeToggle);
    expect(
      (
        await change({
          action: "save_option",
          questionId: copiedDropdown.id,
          optionId: copiedMaybe.id,
          data: {
            label: copiedMaybe.label,
            valueScore: 60,
            isNull: false,
            sortOrder: copiedMaybe.sortOrder,
          },
        })
      ).status,
    ).toBe(200);
    const copiedStory = draftAfterPublish.form.questions.find(
      ({ key }) => key === "story",
    )!;
    expect(
      (
        await change({
          action: "update_question",
          questionId: copiedStory.id,
          data: { label: "Narrative", weight: 6 },
        })
      ).status,
    ).toBe(200);
    const storedBefore = (await queryRow<{
      formVersionId: number;
      overall: number;
    }>(
      'select form_version_id as "formVersionId", overall from ratings where film_id = 1',
    ))!;
    const republished = await publish();
    expect(republished.status).toBe(200);
    const versionThree = (await republished.json()) as {
      form: {
        id: number;
        questions: Array<{
          id: number;
          key: string;
          label: string;
          type: string;
          weight: number | null;
          options: Array<{ id: number; label: string; isNull: boolean }>;
        }>;
      };
    };
    expect(
      versionThree.form.questions.find(({ key }) => key === "story"),
    ).toMatchObject({ key: "story", label: "Narrative", weight: 6 });
    expect(
      await queryRow(
        'select form_version_id as "formVersionId", overall from ratings where film_id = 1',
      ),
    ).toEqual(storedBefore);
    const recomputeRoute = await import("@/app/api/admin/recompute/route");
    const dryRun = (await (
      await recomputeRoute.POST(
        jsonRequest("http://test/api/admin/recompute", "POST", {
          commit: false,
        }),
      )
    ).json()) as {
      changed: number;
      movers: Array<{ filmId: number; delta: number }>;
    };
    expect(dryRun.changed).toBe(1);
    expect(dryRun.movers[0]).toMatchObject({
      filmId: 1,
      delta: expect.any(Number),
    });
    expect(
      await queryRow(
        'select form_version_id as "formVersionId", overall from ratings where film_id = 1',
      ),
    ).toEqual(storedBefore);
    await recomputeRoute.POST(
      jsonRequest("http://test/api/admin/recompute", "POST", { commit: true }),
    );
    const recomputed = (await queryRow<{
      formVersionId: number;
      overall: number;
    }>(
      'select form_version_id as "formVersionId", overall from ratings where film_id = 1',
    ))!;
    expect(recomputed.formVersionId).toBe(versionThree.form.id);
    expect(recomputed.overall).toBeGreaterThan(storedBefore.overall);

    const nullFilmResponse = await createFilm(
      jsonRequest("http://test/api/films", "POST", {
        title: "Contact",
        releaseYear: 1997,
        status: "watched",
      }),
    );
    const nullFilm = (await nullFilmResponse.json()) as { id: number };
    const v3Dropdown = versionThree.form.questions.find(
      ({ key }) => key === "watch_again",
    )!;
    const v3Paragraph = versionThree.form.questions.find(
      ({ key }) => key === "never_again_reason",
    )!;
    const nullOption = v3Dropdown.options.find(({ isNull }) => isNull)!;
    const nullAnswers: RouteAnswer[] =
      versionThree.form.questions.flatMap<RouteAnswer>((question) =>
        question.id === v3Dropdown.id
          ? [{ questionId: question.id, valueOptionIds: [nullOption.id] }]
          : question.id === v3Paragraph.id
            ? []
            : [{ questionId: question.id, valueNumber: 80 }],
      );
    const nullRated = await saveRating(
      jsonRequest(`http://test/api/films/${nullFilm.id}/rating`, "PUT", {
        formVersionId: versionThree.form.id,
        answers: nullAnswers,
        rcaTagIds: [],
      }),
      { params: Promise.resolve({ id: String(nullFilm.id) }) },
    );
    expect(nullRated.status).toBe(200);
    const v3Runtime = (await getPublishedRuntimeForm())!;
    const nullMap = Object.fromEntries(
      nullAnswers.map((answer) => [
        answer.questionId,
        { number: answer.valueNumber, optionIds: answer.valueOptionIds },
      ]),
    );
    expect(
      computeOverallFromForm(v3Runtime, nullMap).terms.find(
        ({ questionId }) => questionId === v3Dropdown.id,
      ),
    ).toMatchObject({ counted: false, reason: "null_option" });

    const deleted = await tagItemRoute.DELETE(
      new Request(`http://test/api/rca-tags/${targetTag.id}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: String(targetTag.id) }) },
    );
    expect(await deleted.json()).toEqual({ deleted: true, usageCount: 1 });

    const archiveDraft = (await (await formRoute.GET()).json()) as {
      form: {
        questions: Array<{
          id: number;
          key: string;
          conditions: Array<{ id: number }>;
        }>;
      };
    };
    const archiveDropdown = archiveDraft.form.questions.find(
      ({ key }) => key === "watch_again",
    )!;
    const archiveParagraph = archiveDraft.form.questions.find(
      ({ key }) => key === "never_again_reason",
    )!;
    for (const condition of archiveParagraph.conditions)
      await change({ action: "delete_condition", conditionId: condition.id });
    await change({
      action: "archive_question",
      questionId: archiveParagraph.id,
    });
    await change({
      action: "archive_question",
      questionId: archiveDropdown.id,
    });
    expect((await publish()).status).toBe(200);
    const historical = await dashboard.getFilmDetail(1);
    expect(historical?.rating?.formVersionId).toBe(versionThree.form.id);
    expect(
      historical?.form?.questions.some(({ key }) => key === "watch_again"),
    ).toBe(true);
    expect(
      historical?.answers.some(
        ({ questionId }) => questionId === v3Dropdown.id,
      ),
    ).toBe(true);
  });
});

function change(body: Record<string, unknown>) {
  return formRoute.POST(
    jsonRequest("http://test/api/admin/form", "POST", body),
  );
}

function jsonRequest(url: string, method: string, body: unknown) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
