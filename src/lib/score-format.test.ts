import { describe, expect, it } from "vitest";
import { formatScore, scoreOutOfFive } from "./score-format";

describe("score format", () => {
  it("halves the stored 0–10 score", () => {
    expect(scoreOutOfFive(8.84524)).toBeCloseTo(4.42262);
    expect(formatScore(8.84524)).toBe("4.4");
  });

  it("rounds to one decimal", () => {
    expect(formatScore(9.94048)).toBe("5.0");
    expect(formatScore(4.91667)).toBe("2.5");
  });

  it("clamps to the 0–5 range", () => {
    expect(formatScore(12)).toBe("5.0");
    expect(formatScore(-1)).toBe("0.0");
  });

  it("uses the fallback for a missing score", () => {
    expect(formatScore(null)).toBe("—");
    expect(formatScore(undefined, "Unrated")).toBe("Unrated");
    expect(scoreOutOfFive(Number.NaN)).toBeNull();
  });
});
