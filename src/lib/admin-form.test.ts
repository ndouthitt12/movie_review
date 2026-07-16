import { describe, expect, it } from "vitest";
import type { RuntimeFormConfig, RuntimeQuestionConfig } from "./form-config";
import { validateFormForPublish } from "./admin-form";

function question(
  patch: Partial<RuntimeQuestionConfig> = {},
): RuntimeQuestionConfig {
  return {
    id: 1,
    key: "score",
    label: "Score",
    helpText: "",
    type: "slider",
    sectionId: 1,
    sortOrder: 10,
    required: true,
    scored: true,
    weight: 1,
    secondaryScored: true,
    secondaryWeight: 1,
    min: 0,
    max: 100,
    offset: 0,
    secondaryOffset: 0,
    blankPolicy: "exclude_and_renormalize",
    secondaryBlankPolicy: "exclude_and_renormalize",
    multiSelectScoring: null,
    allowNa: false,
    conditionLogic: "all",
    rcaEnabled: false,
    archivedAt: null,
    conditions: [],
    options: [],
    ...patch,
  };
}

function form(questions: RuntimeQuestionConfig[]): RuntimeFormConfig {
  return {
    id: 2,
    label: "Draft",
    status: "draft",
    divisorMode: "manual",
    manualDivisor: 100,
    secondaryDivisorMode: "manual",
    secondaryManualDivisor: 100,
    publishedAt: null,
    sections: [{ id: 1, title: "Rating", description: "", sortOrder: 10 }],
    questions,
  };
}

describe("publish validation", () => {
  it("reports missing weights for both formulas", () => {
    const errors = validateFormForPublish(
      form([question({ weight: null, secondaryWeight: null })]),
    );
    expect(errors).toContain("Primary score: “Score” requires a weight.");
    expect(errors).toContain("Secondary score: “Score” requires a weight.");
  });

  it("reports missing or unscored options", () => {
    const dropdown = question({ type: "dropdown", options: [] });
    expect(validateFormForPublish(form([dropdown]))[0]).toContain(
      "at least one non-null option",
    );
    dropdown.options = [
      { id: 10, label: "Yes", sortOrder: 10, valueScore: null, isNull: false },
    ];
    expect(validateFormForPublish(form([dropdown]))[0]).toContain(
      "requires a score",
    );
  });

  it("reports forward-reference and cycle violations", () => {
    const first = question({
      id: 1,
      sortOrder: 10,
      conditions: [
        {
          id: 20,
          sourceQuestionId: 2,
          operator: "answered",
          value: null,
          effect: "show",
        },
      ],
    });
    const second = question({
      id: 2,
      key: "second",
      label: "Second",
      sortOrder: 20,
      conditions: [
        {
          id: 21,
          sourceQuestionId: 1,
          operator: "answered",
          value: null,
          effect: "show",
        },
      ],
    });
    const errors = validateFormForPublish(form([first, second]));
    expect(errors.some((error) => error.includes("must appear before"))).toBe(
      true,
    );
    expect(errors).toContain("Question conditions must be acyclic.");
  });

  it("reports invalid manual and empty auto divisors", () => {
    const manual = form([question()]);
    manual.manualDivisor = 0;
    expect(validateFormForPublish(manual)).toContain(
      "Primary score manual divisor must be greater than zero.",
    );
    const auto = form([question({ scored: false, secondaryScored: false })]);
    auto.divisorMode = "auto";
    auto.secondaryDivisorMode = "auto";
    const errors = validateFormForPublish(auto);
    expect(errors).toContain(
      "Primary score auto divisor requires at least one scored question.",
    );
    expect(errors).toContain(
      "Secondary score auto divisor requires at least one scored question.",
    );
  });

  it("rejects display elements that collect answers or source conditions", () => {
    const title = question({
      id: 1,
      key: "heading",
      label: "Heading",
      type: "title",
      required: false,
      scored: false,
      secondaryScored: false,
    });
    const target = question({
      id: 2,
      key: "target",
      sortOrder: 20,
      conditions: [
        {
          id: 20,
          sourceQuestionId: 1,
          operator: "answered",
          value: null,
          effect: "show",
        },
      ],
    });
    expect(validateFormForPublish(form([title, target]))).toContain(
      "Display element “Heading” cannot be a condition source.",
    );
  });
});
