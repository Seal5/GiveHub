import { Platform, Share } from "react-native";
import { api } from "./api";
import { opportunityShareMessage, opportunityShareUrl, type ShareableOpportunity } from "./shareLink";

export { opportunityShareMessage, opportunityShareUrl };
export type { ShareableOpportunity };

/**
 * Returns true only when the sheet reports a completed share, so the `shared`
 * analytics event is not recorded when the user backs out.
 */
export async function shareOpportunity(
  item: ShareableOpportunity,
  token?: string | null,
): Promise<boolean> {
  const url = opportunityShareUrl(item.id);
  const message = opportunityShareMessage(item);
  const result = await Share.share(
    // iOS renders a separate URL field; Android only reads `message`.
    Platform.OS === "ios"
      ? { title: item.title, message, ...(url ? { url } : {}) }
      : { title: item.title, message: url ? `${message}\n${url}` : message },
  );
  if (result.action !== Share.sharedAction) return false;
  try {
    await api.trackOpportunityEvent(item.id, "shared", token);
  } catch {
    // A missed analytics ping must never surface as a failed share.
  }
  return true;
}
