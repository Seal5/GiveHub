import { describe, expect, it } from "vitest";
import { emptyWaiverDraft, toWaiverPayload, validateWaiver } from "./waiver";

const waiver = { id: "waiver-1", title: "GiveHub volunteer agreement", body: "Terms", version: 2 };

const signedDraft = () => ({ ...emptyWaiverDraft("Mia Thompson"), agreed: true });

describe("waiver validation", () => {
  it("requires the agreement to be ticked", () => {
    expect(validateWaiver(emptyWaiverDraft("Mia Thompson"))).toMatch(/accept the volunteer agreement/i);
  });

  it("requires a typed signature", () => {
    expect(validateWaiver({ ...signedDraft(), signedName: " " })).toMatch(/full name/i);
  });

  it("accepts a signed adult application", () => {
    expect(validateWaiver(signedDraft())).toBeNull();
  });

  it("requires guardian details for a volunteer under 18", () => {
    const draft = { ...signedDraft(), isMinor: true };
    expect(validateWaiver(draft)).toMatch(/guardian's name/i);
    expect(validateWaiver({ ...draft, guardianName: "Ana Thompson" })).toMatch(/guardian email/i);
    expect(validateWaiver({ ...draft, guardianName: "Ana Thompson", guardianEmail: "not-an-email" })).toMatch(/guardian email/i);
    expect(
      validateWaiver({ ...draft, guardianName: "Ana Thompson", guardianEmail: "ana@example.com" }),
    ).toBeNull();
  });
});

describe("waiver payload", () => {
  it("pins the version being signed", () => {
    expect(toWaiverPayload(waiver, signedDraft())).toEqual({
      waiver_document_id: "waiver-1",
      agreed: true,
      signed_name: "Mia Thompson",
      is_minor: false,
    });
  });

  it("omits guardian fields for adults", () => {
    const payload = toWaiverPayload(waiver, {
      ...signedDraft(),
      guardianName: "Ana Thompson",
      guardianEmail: "ana@example.com",
    });
    expect(payload.guardian_name).toBeUndefined();
    expect(payload.guardian_email).toBeUndefined();
  });

  it("includes guardian fields for minors", () => {
    const payload = toWaiverPayload(waiver, {
      ...signedDraft(),
      isMinor: true,
      guardianName: " Ana Thompson ",
      guardianEmail: " ana@example.com ",
      guardianRelationship: "Parent",
    });
    expect(payload).toMatchObject({
      is_minor: true,
      guardian_name: "Ana Thompson",
      guardian_email: "ana@example.com",
      guardian_relationship: "Parent",
    });
  });
});
