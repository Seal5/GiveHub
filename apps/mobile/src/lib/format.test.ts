import { describe, expect, it } from "vitest";
import { formatEventDate, statusLabel } from "./format";

describe("GiveHub formatting", () => {
  it("uses clear copy for statuses", () => {
    expect(statusLabel.confirmed).toBe("You’re in");
    expect(statusLabel.under_review).toBe("Under review");
  });

  it("formats event dates in Toronto time", () => {
    expect(formatEventDate("2026-07-25T21:00:00.000Z")).toContain("Jul 25");
  });
});
