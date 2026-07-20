import { describe, expect, it } from "vitest";
import {
  buttonScaleDisplayValue,
  buttonScaleStoredValue,
  formatButtonScaleValue,
  isButtonScaleStoredValue,
  normalizeLegacyButtonScaleValue,
} from "./button-scale";

describe("button scale values", () => {
  it("maps integer and half-point display values to the legacy scale", () => {
    expect(buttonScaleStoredValue(1)).toBe(10);
    expect(buttonScaleStoredValue(5.5)).toBe(55);
    expect(buttonScaleStoredValue(10)).toBe(100);
    expect(buttonScaleDisplayValue(95)).toBe(9.5);
    expect(formatButtonScaleValue(55)).toBe("5.5");
  });

  it("accepts only half-point increments from one through ten", () => {
    expect([10, 15, 95, 100].every(isButtonScaleStoredValue)).toBe(true);
    expect([5, 52, 105, Number.NaN].some(isButtonScaleStoredValue)).toBe(false);
  });

  it("clamps and rounds legacy values to the nearest half point", () => {
    expect(normalizeLegacyButtonScaleValue(0)).toBe(10);
    expect(normalizeLegacyButtonScaleValue(72)).toBe(70);
    expect(normalizeLegacyButtonScaleValue(73)).toBe(75);
    expect(normalizeLegacyButtonScaleValue(101)).toBe(100);
  });
});
