import { describe, expect, it } from "vitest";
import {
  buttonScaleDisplayValue,
  buttonScaleStoredValue,
  formatButtonScaleValue,
  isButtonScaleStoredValue,
  normalizeLegacyButtonScaleValue,
  parseButtonScaleInput,
} from "./button-scale";

describe("button scale values", () => {
  it("maps display values to the legacy scale", () => {
    expect(buttonScaleStoredValue(1)).toBe(10);
    expect(buttonScaleStoredValue(5.5)).toBe(55);
    expect(buttonScaleStoredValue(10)).toBe(100);
    expect(buttonScaleStoredValue(1.1)).toBe(11);
    expect(buttonScaleDisplayValue(95)).toBe(9.5);
    expect(formatButtonScaleValue(55)).toBe("5.5");
    expect(formatButtonScaleValue(93)).toBe("9.3");
  });

  it("accepts tenths from one through ten", () => {
    expect([10, 15, 93, 95, 100].every(isButtonScaleStoredValue)).toBe(true);
    expect([5, 92.5, 105, Number.NaN].some(isButtonScaleStoredValue)).toBe(
      false,
    );
  });

  it("clamps and rounds legacy values to the nearest tenth", () => {
    expect(normalizeLegacyButtonScaleValue(0)).toBe(10);
    expect(normalizeLegacyButtonScaleValue(72)).toBe(72);
    expect(normalizeLegacyButtonScaleValue(72.6)).toBe(73);
    expect(normalizeLegacyButtonScaleValue(101)).toBe(100);
  });

  it("reads a typed exact score with at most one decimal", () => {
    expect(parseButtonScaleInput("9.3")).toBe(93);
    expect(parseButtonScaleInput(" 8.1 ")).toBe(81);
    expect(parseButtonScaleInput("7")).toBe(70);
    expect(parseButtonScaleInput("10.0")).toBe(100);
    expect(parseButtonScaleInput("1.1")).toBe(11);
  });

  it("refuses a typed score outside 1 to 10 or finer than a tenth", () => {
    for (const text of ["9.35", "10.1", "0.9", "0", "", "abc", "-5", "9."])
      expect(parseButtonScaleInput(text)).toBeNull();
  });
});
