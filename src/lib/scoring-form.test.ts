import { describe, expect, it } from "vitest";
import { defaultWeights } from "@/db/seed-data";
import {
  computeOverall,
  computeOverallFromForm,
  evaluateFormConditions,
  type AnswerMap,
  type AttributeScores,
  type FormConfig,
  type QuestionConfig,
} from "./scoring";

function question(
  overrides: Partial<QuestionConfig> & Pick<QuestionConfig, "id" | "key">,
): QuestionConfig {
  const { id, key, ...rest } = overrides;
  return {
    id,
    key,
    type: "slider",
    required: false,
    scored: true,
    weight: 1,
    min: 0,
    max: 100,
    offset: 0,
    blankPolicy: "exclude_and_renormalize",
    multiSelectScoring: null,
    allowNa: false,
    conditionLogic: "all",
    conditions: [],
    options: [],
    ...rest,
  };
}

function manualForm(
  questions: QuestionConfig[],
  manualDivisor: number,
): FormConfig {
  return { divisorMode: "manual", manualDivisor, questions };
}

const v1Questions: QuestionConfig[] = [
  question({ id: 1, key: "story", weight: 5 }),
  question({ id: 2, key: "direction", weight: 5 }),
  question({ id: 3, key: "writing", weight: 5 }),
  question({ id: 4, key: "acting", weight: 5 }),
  question({ id: 5, key: "music", weight: 2 }),
  question({ id: 6, key: "impact", weight: 4 }),
  question({ id: 7, key: "rewatchability", weight: 10, offset: -50 }),
  question({ id: 8, key: "genre_fit", weight: 3 }),
];
const v1Form = manualForm(v1Questions, 334);

function answersFor(scores: AttributeScores): AnswerMap {
  return Object.fromEntries(
    v1Questions.map((config) => [
      config.id,
      {
        number:
          config.key === "genre_fit"
            ? scores.genreFit
            : scores[config.key as Exclude<keyof AttributeScores, "genreFit">],
      },
    ]),
  );
}

const perfect: AttributeScores = {
  story: 100,
  direction: 100,
  writing: 100,
  acting: 100,
  music: 100,
  impact: 100,
  rewatchability: 100,
  genreFit: 100,
};

describe("form scoring", () => {
  it.each([
    { ...perfect, story: 96, music: 98, impact: 90 },
    { ...perfect, story: 80, music: 95, impact: 95, genreFit: 95 },
    { ...perfect, story: 80, writing: 80 },
  ])("matches the legacy v1 formula within 1e-9", (scores) => {
    const legacy = computeOverall(scores, defaultWeights);
    const generalized = computeOverallFromForm(
      v1Form,
      answersFor(scores),
    ).overall;
    expect(Math.abs(generalized - legacy)).toBeLessThan(1e-9);
  });

  it("excludes a null option and renormalizes the manual divisor", () => {
    const optional = question({
      id: 1,
      key: "choice",
      type: "dropdown",
      options: [
        { id: 11, valueScore: 100, isNull: false },
        { id: 12, valueScore: null, isNull: true },
      ],
    });
    const base = question({ id: 2, key: "base" });
    const result = computeOverallFromForm(manualForm([optional, base], 200), {
      1: { optionIds: [12] },
      2: { number: 100 },
    });

    expect(result.overall).toBe(1);
    expect(result.terms[0]).toMatchObject({
      counted: false,
      reason: "null_option",
    });
  });

  it("excludes an N/A answer and renormalizes", () => {
    const result = computeOverallFromForm(
      manualForm(
        [
          question({ id: 1, key: "optional", allowNa: true }),
          question({ id: 2, key: "base" }),
        ],
        200,
      ),
      { 1: { isNa: true }, 2: { number: 100 } },
    );

    expect(result.overall).toBe(1);
    expect(result.terms[0].reason).toBe("na");
  });

  it("distinguishes both blank policies", () => {
    const base = question({ id: 1, key: "base" });
    const renormalized = question({ id: 2, key: "optional" });
    const zeroed = question({
      id: 2,
      key: "optional",
      blankPolicy: "treat_as_zero",
    });

    expect(
      computeOverallFromForm(manualForm([base, renormalized], 200), {
        1: { number: 100 },
      }).overall,
    ).toBe(1);
    expect(
      computeOverallFromForm(manualForm([base, zeroed], 200), {
        1: { number: 100 },
      }).overall,
    ).toBe(0.5);
  });

  it("renormalizes a question suppressed by a show condition", () => {
    const source = question({
      id: 1,
      key: "source",
      type: "multiple_choice",
      scored: false,
      weight: null,
      options: [
        { id: 11, valueScore: null, isNull: false },
        { id: 12, valueScore: null, isNull: false },
      ],
    });
    const dependent = question({
      id: 2,
      key: "dependent",
      conditions: [
        {
          sourceQuestionId: 1,
          operator: "equals",
          value: 11,
          effect: "show",
        },
      ],
    });
    const base = question({ id: 3, key: "base" });
    const result = computeOverallFromForm(
      manualForm([source, dependent, base], 200),
      {
        1: { optionIds: [12] },
        2: { number: 100 },
        3: { number: 100 },
      },
    );

    expect(result.overall).toBe(1);
    expect(result.terms[1].reason).toBe("suppressed");
  });

  it("suppresses transitively even when a hidden source retains an answer", () => {
    const first = question({
      id: 1,
      key: "first",
      type: "multiple_choice",
      scored: false,
      weight: null,
      options: [
        { id: 11, valueScore: null, isNull: false },
        { id: 12, valueScore: null, isNull: false },
      ],
    });
    const middle = question({
      id: 2,
      key: "middle",
      type: "multiple_choice",
      scored: false,
      weight: null,
      options: [{ id: 21, valueScore: null, isNull: false }],
      conditions: [
        {
          sourceQuestionId: 1,
          operator: "equals",
          value: 11,
          effect: "show",
        },
      ],
    });
    const final = question({
      id: 3,
      key: "final",
      conditions: [
        {
          sourceQuestionId: 2,
          operator: "equals",
          value: 21,
          effect: "show",
        },
      ],
    });
    const base = question({ id: 4, key: "base" });
    const result = computeOverallFromForm(
      manualForm([first, middle, final, base], 200),
      {
        1: { optionIds: [12] },
        2: { optionIds: [21] },
        3: { number: 100 },
        4: { number: 100 },
      },
    );

    expect(result.overall).toBe(1);
    expect(result.terms[2].reason).toBe("suppressed");
  });

  it("propagates a disabled condition transitively despite retained answers", () => {
    const source = question({ id: 1, key: "source" });
    const disabled = question({
      id: 2,
      key: "disabled",
      conditions: [{ sourceQuestionId: 1, operator: "gte", value: 50, effect: "disable" }],
    });
    const dependent = question({
      id: 3,
      key: "dependent",
      conditions: [{ sourceQuestionId: 2, operator: "answered", value: null, effect: "show" }],
    });
    const form = manualForm([source, disabled, dependent], 301);
    const answers = { 1: { number: 10 }, 2: { number: 100 }, 3: { number: 100 } };
    const states = evaluateFormConditions(form, answers);
    const result = computeOverallFromForm(form, answers);
    expect(states[2]).toEqual({ visible: true, enabled: false });
    expect(states[3]).toEqual({ visible: false, enabled: true });
    expect(result.terms.slice(1).every((term) => term.reason === "suppressed")).toBe(true);
  });

  it("scores multi-select answers with sum or average", () => {
    const options = [
      { id: 11, valueScore: 20, isNull: false },
      { id: 12, valueScore: 40, isNull: false },
    ];
    const sum = question({
      id: 1,
      key: "multi",
      type: "multi_select",
      weight: 2,
      multiSelectScoring: "sum",
      options,
    });
    const avg = { ...sum, multiSelectScoring: "avg" as const };

    expect(
      computeOverallFromForm(manualForm([sum], 120), {
        1: { optionIds: [11, 12] },
      }).terms[0].points,
    ).toBe(120);
    expect(
      computeOverallFromForm(manualForm([avg], 80), {
        1: { optionIds: [11, 12] },
      }).terms[0].points,
    ).toBe(60);
  });

  it("supports auto and manual divisors", () => {
    const scored = question({ id: 1, key: "score" });
    expect(
      computeOverallFromForm(
        { divisorMode: "auto", manualDivisor: null, questions: [scored] },
        { 1: { number: 50 } },
      ).overall,
    ).toBe(0.5);
    expect(
      computeOverallFromForm(manualForm([scored], 50), {
        1: { number: 50 },
      }).overall,
    ).toBe(1);
  });

  it("throws when the effective divisor is not positive", () => {
    expect(() =>
      computeOverallFromForm(
        { divisorMode: "manual", manualDivisor: null, questions: [] },
        {},
      ),
    ).toThrow(RangeError);
    expect(() =>
      computeOverallFromForm(
        { divisorMode: "auto", manualDivisor: null, questions: [] },
        {},
      ),
    ).toThrow(RangeError);
  });

  it("fuzzes transitive conditions without loops or suppressed contributions", () => {
    let seed = 0x51f15e;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };

    for (let sample = 0; sample < 250; sample += 1) {
      const count = 3 + Math.floor(random() * 8);
      const questions = Array.from({ length: count }, (_, index) => {
        const current = question({ id: index + 1, key: `q_${index + 1}` });
        if (index > 0 && random() < 0.75) {
          current.conditions = [
            {
              sourceQuestionId: 1 + Math.floor(random() * index),
              operator: random() < 0.5 ? "gte" : "lte",
              value: 50,
              effect: random() < 0.5 ? "show" : "disable",
            },
          ];
        }
        return current;
      });
      const answers: AnswerMap = Object.fromEntries(
        questions.map(({ id }) => [id, { number: Math.floor(random() * 101) }]),
      );
      const form = manualForm(questions, count * 100 + 1);
      const states = evaluateFormConditions(form, answers);
      const result = computeOverallFromForm(form, answers);
      for (const term of result.terms) {
        const state = states[term.questionId];
        if (!state.visible || !state.enabled)
          expect(term).toMatchObject({ counted: false, points: 0, reason: "suppressed" });
      }
    }

    const cyclic = manualForm(
      [
        question({ id: 1, key: "cycle_a", conditions: [{ sourceQuestionId: 2, operator: "answered", value: null, effect: "show" }] }),
        question({ id: 2, key: "cycle_b", conditions: [{ sourceQuestionId: 1, operator: "answered", value: null, effect: "show" }] }),
      ],
      201,
    );
    expect(() => evaluateFormConditions(cyclic, { 1: { number: 10 }, 2: { number: 20 } })).not.toThrow();
    expect(computeOverallFromForm(cyclic, { 1: { number: 10 }, 2: { number: 20 } }).terms.every((term) => !term.counted)).toBe(true);
  });
});
