import { describe, expect, it } from "vitest";
import { dateInTimeZone } from "./dates";

describe("dateInTimeZone", () => {
  it("keeps Arizona evening activity on the local calendar day", () => {
    expect(
      dateInTimeZone(new Date("2026-07-13T03:30:00.000Z"), "America/Phoenix"),
    ).toBe("2026-07-12");
  });
});
