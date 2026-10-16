import { describe, expect, it } from "vitest";
import { opportunities, profileFor } from "./fixtures";
import { rankDemoOpportunities } from "./ranking";

describe("demo recommendation parity", () => {
  it("rotates comparable hosts while keeping all alternatives visible", () => {
    const first = { ...opportunities[0]!, id: "a1", organisation_name: "Host A", distance_km: 1 };
    const second = { ...first, id: "a2", distance_km: 2 };
    const third = { ...first, id: "b1", organisation_name: "Host B", distance_km: 3 };
    const results = rankDemoOpportunities([first, second, third], profileFor("volunteer"), false);
    expect(results.map(i => i.id)).toEqual(["a1", "b1", "a2"]);
  });

  it("explains availability matches using Toronto time even around UTC midnight", () => {
    const profile = { ...profileFor("volunteer"), preferred_availability: ["weekend_evening"] };
    const item = { ...opportunities[0]!, starts_at: "2026-08-02T02:00:00Z" };
    expect(rankDemoOpportunities([item], profile, true)[0]!.match_reasons).toContain("Fits your usual availability");
  });
});
