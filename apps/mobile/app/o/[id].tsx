import { useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/providers/AuthProvider";
import { LoadingState, Screen } from "@/components/ui";
import { setPendingRoute } from "@/lib/pendingRoute";

/**
 * Entry point for shared links (`givehub://o/<id>` and the matching web URL).
 * Signed-in volunteers go straight to the opportunity; everyone else is sent to
 * the welcome flow with the destination held until they have a profile.
 */
export default function SharedOpportunityLink() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, loading } = useAuth();

  useEffect(() => {
    if (loading || !id) return;
    const target = { pathname: "/(volunteer)/opportunity/[id]" as const, params: { id } };
    if (profile?.role === "volunteer") {
      router.replace(target);
      return;
    }
    if (profile?.role === "organiser") {
      // Organisers have no volunteer discovery surface; land them on their overview.
      router.replace("/(organiser)");
      return;
    }
    setPendingRoute(`/(volunteer)/opportunity/${id}`);
    router.replace("/welcome");
  }, [id, loading, profile]);

  return <Screen scroll={false}><LoadingState label="Opening this opportunity…" /></Screen>;
}
