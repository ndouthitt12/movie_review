import { describe, expect, it } from "vitest";
import { getFilmGenres, matchesGenres, uniqueGenres } from "./genres";
import {
  computeOverallFromForm,
  evaluateFormConditions,
  type FormConfig,
  type QuestionConfig,
} from "./scoring";

function question(id: number, applicableGenres: string[] = []): QuestionConfig {
  return {
    id,
    key: `q_${id}`,
    type: "slider",
    required: true,
    scored: true,
    weight: 1,
    min: 0,
    max: 100,
    offset: 0,
    blankPolicy: "treat_as_zero",
    multiSelectScoring: null,
    allowNa: false,
    conditionLogic: "all",
    conditions: [],
    options: [],
    applicableGenres,
  };
}

const form: FormConfig = {
  divisorMode: "manual",
  manualDivisor: 40,
  questions: [
    question(1),
    question(2, ["Horror"]),
    question(3, ["Comedy"]),
    question(4, ["Horror", "Comedy"]),
  ],
};
const answers = {
  1: { number: 80 },
  2: { number: 60 },
  3: { number: 90 },
  4: { number: 70 },
};

describe("genre-dependent questions", () => {
  it("collects every film genre and normalizes duplicate names and Sci-Fi aliases", () => {
    expect(
      getFilmGenres({
        genrePrimary: " horror ",
        genreSecondary: "Comedy",
        tmdbGenres: ["Horror", "Science Fiction", "Sci-Fi"],
      }),
    ).toEqual(["Comedy", "horror", "Sci-Fi"]);
    expect(uniqueGenres(["", "Comedy", "comedy", "Drama"])).toEqual([
      "Comedy",
      "Drama",
    ]);
    expect(matchesGenres(["Sci-Fi"], ["Science Fiction"])).toBe(true);
  });

  it.each([
    [[], [1], 8],
    [["Drama"], [1], 8],
    [["Horror"], [1, 2, 4], 7],
    [["Comedy"], [1, 3, 4], 8],
    [["Horror", "Comedy"], [1, 2, 3, 4], 7.5],
  ] as const)(
    "shows all matching questions for %j and keeps manual scoring on its scale",
    (genres, visible, overall) => {
      const states = evaluateFormConditions(form, answers, genres);
      expect(
        form.questions.filter((q) => states[q.id].visible).map((q) => q.id),
      ).toEqual(visible);
      const score = computeOverallFromForm(form, answers, genres);
      expect(score.overall).toBeCloseTo(overall);
      expect(
        score.terms
          .filter((term) => term.counted)
          .map((term) => term.questionId),
      ).toEqual(visible);
      // Hidden retained answers and treat_as_zero must not contribute.
      expect(
        score.terms
          .filter((term) => !term.counted)
          .every((term) => term.reason === "suppressed"),
      ).toBe(true);
      expect(
        computeOverallFromForm(
          { ...form, divisorMode: "auto" },
          answers,
          genres,
        ).overall,
      ).toBeCloseTo(overall / 10);
    },
  );

  it("combines genre gates with answer conditions and suppresses their dependents", () => {
    const fear = question(2, ["Horror"]);
    fear.conditions = [
      { sourceQuestionId: 1, operator: "gte", value: 90, effect: "show" },
    ];
    const dependent = question(3);
    dependent.conditions = [
      {
        sourceQuestionId: 2,
        operator: "answered",
        value: null,
        effect: "show",
      },
    ];
    const conditional = { ...form, questions: [question(1), fear, dependent] };
    for (const [sample, genres, visible] of [
      [answers, ["Horror"], false],
      [{ ...answers, 1: { number: 95 } }, ["Comedy"], false],
      [{ ...answers, 1: { number: 95 } }, ["Horror"], true],
    ] as const) {
      const states = evaluateFormConditions(conditional, sample, genres);
      expect(states[2].visible).toBe(visible);
      expect(states[3].visible).toBe(visible);
    }
  });
});
