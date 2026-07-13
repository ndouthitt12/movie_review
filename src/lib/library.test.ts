import { describe, expect, it } from "vitest";
import { compareLibraryValues, sameIdSet } from "./library";

describe("library helpers", () => {
  it("sorts ISO dates symmetrically and keeps missing values last", () => {
    expect(compareLibraryValues(null, "2026-01-01", "asc")).toBe(1);
    expect(compareLibraryValues("2026-01-01", null, "asc")).toBe(-1);
    expect(
      compareLibraryValues("2025-01-01", "2026-01-01", "desc"),
    ).toBeGreaterThan(0);
  });

  it("requires reorder payloads to contain the complete unique ID set", () => {
    expect(sameIdSet([2, 1], [1, 2])).toBe(true);
    expect(sameIdSet([1], [1, 2])).toBe(false);
    expect(sameIdSet([1, 1], [1, 2])).toBe(false);
  });
});
