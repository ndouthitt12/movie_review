import { describe, expect, it } from "vitest";
import { displayScore, formatScore, toScoreScale } from "./score-format";

describe("score format", () => {
  it("halves the stored 0–10 score out of 5", () => {
    expect(displayScore(8.84524, 5)).toBeCloseTo(4.42262);
    expect(formatScore(8.84524, 5)).toBe("4.4");
  });

  it("keeps the stored 0–10 score out of 10", () => {
    expect(displayScore(8.84524, 10)).toBeCloseTo(8.84524);
    expect(formatScore(8.84524, 10)).toBe("8.8");
  });

  it("rounds to one decimal", () => {
    expect(formatScore(9.94048, 5)).toBe("5.0");
    expect(formatScore(4.91667, 5)).toBe("2.5");
    expect(formatScore(9.96, 10)).toBe("10.0");
  });

  it("clamps to the range of the scale", () => {
    expect(formatScore(12, 5)).toBe("5.0");
    expect(formatScore(-1, 5)).toBe("0.0");
    expect(formatScore(12, 10)).toBe("10.0");
  });

  it("uses the fallback for a missing score", () => {
    expect(formatScore(null, 5)).toBe("—");
    expect(formatScore(undefined, 10, "Unrated")).toBe("Unrated");
    expect(displayScore(Number.NaN, 5)).toBeNull();
  });

  it("accepts only 5 or 10 as a scale", () => {
    expect(toScoreScale(10)).toBe(10);
    expect(toScoreScale(5)).toBe(5);
    expect(toScoreScale(7)).toBe(5);
    expect(toScoreScale("10")).toBe(5);
    expect(toScoreScale(undefined)).toBe(5);
  });
});
