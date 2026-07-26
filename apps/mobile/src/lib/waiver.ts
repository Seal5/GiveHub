import type { Waiver, WaiverAcceptanceInput } from "./types";

export type WaiverDraft = {
  agreed: boolean;
  signedName: string;
  isMinor: boolean;
  guardianName: string;
  guardianEmail: string;
  guardianRelationship: string;
};

export const emptyWaiverDraft = (signedName = ""): WaiverDraft => ({
  agreed: false,
  signedName,
  isMinor: false,
  guardianName: "",
  guardianEmail: "",
  guardianRelationship: "",
});

/** Mirrors the server-side rules so the volunteer sees problems before submitting. */
export function validateWaiver(draft: WaiverDraft): string | null {
  if (!draft.agreed) return "Tick the box to accept the volunteer agreement.";
  if (draft.signedName.trim().length < 2) return "Type your full name as your signature.";
  if (draft.isMinor) {
    if (draft.guardianName.trim().length < 2) return "Add your parent or guardian's name.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.guardianEmail.trim())) {
      return "Add a valid parent or guardian email.";
    }
  }
  return null;
}

export function toWaiverPayload(waiver: Waiver, draft: WaiverDraft): WaiverAcceptanceInput {
  return {
    waiver_document_id: waiver.id,
    agreed: draft.agreed,
    signed_name: draft.signedName.trim(),
    is_minor: draft.isMinor,
    ...(draft.isMinor
      ? {
          guardian_name: draft.guardianName.trim(),
          guardian_email: draft.guardianEmail.trim(),
          ...(draft.guardianRelationship.trim() ? { guardian_relationship: draft.guardianRelationship.trim() } : {}),
        }
      : {}),
  };
}
