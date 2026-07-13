import { describe, expect, it } from "vitest";
import { computeStreaks, weeklyGoalPace } from "./streaks";

describe("streak engine", () => {
  it("deduplicates days and stops current streaks after a gap", () => {
    const summary = computeStreaks(
      ["2026-07-08", "2026-07-09", "2026-07-09", "2026-07-11"],
      "2026-07-13",
    );
    expect(summary.day).toEqual({ current: 0, longest: 2 });
  });

  it("is calendar-safe across year boundaries for every granularity", () => {
    const summary = computeStreaks(
      ["2025-11-15", "2025-12-29", "2026-01-04", "2026-01-05"],
      "2026-01-06",
    );
    expect(summary.day).toEqual({ current: 2, longest: 2 });
    expect(summary.week).toEqual({ current: 2, longest: 2 });
    expect(summary.month).toEqual({ current: 3, longest: 3 });
  });

  it("treats ISO dates as calendar dates without DST-sensitive arithmetic", () => {
    expect(
      computeStreaks(["2026-03-07", "2026-03-08", "2026-03-09"], "2026-03-09")
        .day,
    ).toEqual({ current: 3, longest: 3 });
  });

  it("ignores future-dated watches when calculating current state", () => {
    expect(
      computeStreaks(["2026-07-12", "2026-07-14"], "2026-07-13").day,
    ).toEqual({ current: 1, longest: 1 });
    expect(
      weeklyGoalPace(["2026-07-13", "2026-07-17"], 3, "2026-07-13"),
    ).toMatchObject({ watched: 1, remaining: 2 });
  });

  it("reports optional weekly goal pace from every watch in the current week", () => {
    expect(weeklyGoalPace([], null, "2026-07-13")).toBeNull();
    expect(
      weeklyGoalPace(
        ["2026-07-13", "2026-07-13", "2026-07-14"],
        3,
        "2026-07-14",
      ),
    ).toMatchObject({ watched: 3, remaining: 0, status: "complete" });
  });
});
