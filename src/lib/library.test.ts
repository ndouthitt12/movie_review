import { describe, expect, it } from "vitest";
import { compareLibraryValues, sameIdSet, validRcaFilterIds } from "./library";

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

  it("drops stale, invalid, and duplicate RCA ids from URL filters", () => {
    expect(validRcaFilterIds("1,999,2,1,nope,-4", [1, 2, 3])).toEqual([1, 2]);
    expect(validRcaFilterIds("999", [1, 2, 3])).toEqual([]);
  });
});
