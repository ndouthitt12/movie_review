import { describe, expect, it } from "vitest";
import { defaultWeights } from "@/db/seed-data";
import {
  computeOverall,
  computeSecondary,
  rankFilms,
  type AttributeScores,
} from "./scoring";

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

describe("computeOverall", () => {
  it.each([
    [
      "Jurassic Park",
      { ...perfect, story: 96, music: 98, impact: 90 },
      9.988023952,
    ],
    [
      "The Two Towers",
      { ...perfect, story: 80, music: 95, impact: 95, genreFit: 95 },
      9.745508982,
    ],
    ["Good Will Hunting", { ...perfect, story: 80, writing: 80 }, 9.580838323],
  ])("pins the spreadsheet result for %s", (_title, scores, expected) => {
    expect(computeOverall(scores, defaultWeights)).toBeCloseTo(expected, 9);
  });

  it("clamps a negative weighted score to zero", () => {
    expect(
      computeOverall(
        {
          story: 0,
          direction: 0,
          writing: 0,
          acting: 0,
          music: 0,
          impact: 0,
          rewatchability: 0,
          genreFit: 0,
        },
        defaultWeights,
      ),
    ).toBe(0);
  });

  it("rejects a non-positive divisor", () => {
    expect(() =>
      computeOverall(perfect, { ...defaultWeights, divisor: 0 }),
    ).toThrow(/divisor/);
  });
});

describe("computeSecondary", () => {
  it("uses the spreadsheet's 5/4/1 weighting", () => {
    expect(computeSecondary(80, 70, 90)).toBe(7.7);
  });
});

describe("rankFilms", () => {
  it("uses competition ranking and preserves input order", () => {
    expect(
      rankFilms([
        { title: "B", overall: 8 },
        { title: "A", overall: 9 },
        { title: "C", overall: 8 },
        { title: "D", overall: 7 },
      ]).map(({ title, rank }) => ({ title, rank })),
    ).toEqual([
      { title: "B", rank: 2 },
      { title: "A", rank: 1 },
      { title: "C", rank: 2 },
      { title: "D", rank: 4 },
    ]);
  });
});
