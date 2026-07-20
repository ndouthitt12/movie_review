import { describe, expect, it } from "vitest";
import {
  answerSchema,
  conditionSchema,
  questionOptionSchema,
  questionSchema,
} from "./validation";

const baseQuestion = {
  formVersionId: 1,
  key: "story",
  label: "Story",
  type: "slider" as const,
  sortOrder: 0,
};

describe("form configuration validation", () => {
  it("applies slider bounds and rejects scored questions without weights", () => {
    const parsed = questionSchema.parse(baseQuestion);
    expect(parsed).toMatchObject({ min: 0, max: 100, required: true });
    expect(
      questionSchema.safeParse({ ...baseQuestion, scored: true }).success,
    ).toBe(false);
    expect(
      questionSchema.safeParse({
        ...baseQuestion,
        scored: true,
        weight: 5,
      }).success,
    ).toBe(true);
  });

  it("normalizes button scales and their endpoint labels", () => {
    const parsed = questionSchema.parse({
      ...baseQuestion,
      type: "button_scale",
      min: 0,
      max: 20,
      scaleMinLabel: "Weak",
      scaleMaxLabel: "Essential",
    });
    expect(parsed).toMatchObject({
      min: 10,
      max: 100,
      scaleMinLabel: "Weak",
      scaleMaxLabel: "Essential",
    });
  });

  it("prevents text questions from being scored", () => {
    expect(
      questionSchema.safeParse({
        ...baseQuestion,
        type: "paragraph",
        scored: true,
        weight: 1,
      }).success,
    ).toBe(false);
  });

  it("normalizes display elements so they never collect or score answers", () => {
    const parsed = questionSchema.parse({
      ...baseQuestion,
      type: "title",
      required: true,
      scored: true,
      secondaryScored: true,
      allowNa: true,
      rcaEnabled: true,
      min: 0,
      max: 100,
    });
    expect(parsed).toMatchObject({
      type: "title",
      required: false,
      scored: false,
      weight: null,
      secondaryScored: false,
      secondaryWeight: null,
      allowNa: false,
      rcaEnabled: false,
      min: null,
      max: null,
    });
  });

  it("requires scores for active non-null options of scored parents", () => {
    expect(
      questionOptionSchema.safeParse({
        questionId: 1,
        label: "Absolutely",
        sortOrder: 0,
        parentScored: true,
      }).success,
    ).toBe(false);
    expect(
      questionOptionSchema.safeParse({
        questionId: 1,
        label: "N/A",
        sortOrder: 1,
        parentScored: true,
        isNull: true,
      }).success,
    ).toBe(true);
  });

  it("requires condition sources to precede targets", () => {
    expect(
      conditionSchema.safeParse({
        questionId: 2,
        sourceQuestionId: 1,
        operator: "equals",
        value: 10,
        effect: "show",
        sourceSortOrder: 2,
        targetSortOrder: 1,
      }).success,
    ).toBe(false);
  });

  it("rejects conflicting answer channels", () => {
    expect(
      answerSchema.safeParse({
        questionId: 1,
        valueNumber: 50,
        valueText: "fifty",
      }).success,
    ).toBe(false);
    expect(
      answerSchema.safeParse({
        questionId: 1,
        valueNumber: 50,
        isNa: true,
      }).success,
    ).toBe(false);
  });
});
