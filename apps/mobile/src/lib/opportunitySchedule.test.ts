import { describe, expect, it } from "vitest";
import { parseEventDateTime, scheduleError } from "./opportunitySchedule";

describe("opportunity scheduling", () => {
  it("parses a valid local date and time", () => {
    const value = parseEventDateTime("2026-08-14", "09:30");
    expect(value?.getFullYear()).toBe(2026);
    expect(value?.getMonth()).toBe(7);
    expect(value?.getDate()).toBe(14);
    expect(value?.getHours()).toBe(9);
    expect(value?.getMinutes()).toBe(30);
  });

  it("rejects calendar dates that JavaScript would otherwise roll forward", () => {
    expect(parseEventDateTime("2026-02-31", "09:00")).toBeNull();
  });

  it("requires an end after the start", () => {
    expect(scheduleError("2026-08-14", "12:00", "09:00", false)).toBe(
      "End time must be after the start time.",
    );
  });

  it("requires future schedules for new opportunities", () => {
    expect(scheduleError("2026-08-14", "09:00", "12:00", true, new Date("2026-08-15T00:00:00"))).toBe(
      "Choose a start time in the future.",
    );
  });
});
