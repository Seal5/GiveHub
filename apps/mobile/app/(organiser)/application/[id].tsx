import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ApplicationStatus, WaiverAcceptance } from "@/lib/types";
import { useAuth } from "@/providers/AuthProvider";
import { Body, Button, Card, Display, EmptyState, ErrorState, Eyebrow, LoadingState, Screen, useThemeColours } from "@/components/ui";
import { statusLabel } from "@/lib/format";

function DetailCard({ title, value, className = "" }: { title: string; value: string; className?: string }) {
  return (
    <Card className={className}>
      <Text className="font-medium text-sm text-foreground dark:text-dark-foreground">{title}</Text>
      <Body className="mt-2">{value}</Body>
    </Card>
  );
}

function WaiverSummary({ waiver }: { waiver: WaiverAcceptance | null }) {
  const colours = useThemeColours();
  const signed = Boolean(waiver);
  const signedOn = waiver
    ? new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "short", year: "numeric", timeZone: "Pacific/Auckland" }).format(new Date(waiver.accepted_at))
    : null;
  return (
    <Card className="mb-7">
      <View className="flex-row items-center gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-xl bg-secondary dark:bg-dark-secondary">
          <Ionicons name={signed ? "shield-checkmark" : "alert-circle-outline"} size={18} color={signed ? colours.primary : colours.destructive} />
        </View>
        <Text className="flex-1 font-medium text-sm text-foreground dark:text-dark-foreground">
          {signed ? "Waiver signed" : "No waiver on file"}
        </Text>
      </View>
      {waiver ? (
        <>
          <Body className="mt-3">Signed by {waiver.signed_name} on {signedOn}</Body>
          <Body>{waiver.waiver_title} · version {waiver.waiver_version}</Body>
          {waiver.is_minor ? (
            <View className="mt-3 rounded-card bg-secondary p-3 dark:bg-dark-secondary">
              <Text className="font-strong text-xs uppercase tracking-[1.2px] text-primary dark:text-dark-primary">Under 18 · guardian consent</Text>
              <Body className="mt-1">
                {waiver.guardian_name}
                {waiver.guardian_relationship ? ` (${waiver.guardian_relationship})` : ""}
                {`\n${waiver.guardian_email}`}
              </Body>
            </View>
          ) : null}
        </>
      ) : (
        <Body className="mt-3">This application was made before a waiver was required, or the listing does not require one.</Body>
      )}
    </Card>
  );
}

export default function ApplicantDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const client = useQueryClient();
  const events = useQuery({ queryKey: ["organiser", "events"], queryFn: () => api.organiserOpportunities(token) });
  const pipelines = useQuery({
    queryKey: ["pipeline", "all", events.data?.map((item) => item.id)],
    enabled: Boolean(events.data?.length),
    queryFn: async () => {
      const results = await Promise.all((events.data ?? []).map((event) => api.pipeline(event.id, token)));
      return results.flatMap((item) => item.applications);
    },
  });
  const item = pipelines.data?.find((candidate) => candidate.id === id);
  const transition = useMutation({
    mutationFn: (status: ApplicationStatus) => api.transition(id, status, item!.version, token),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["pipeline"] });
      client.invalidateQueries({ queryKey: ["organiser"] });
      router.replace("/(organiser)/pipeline");
    },
  });

  if (events.isLoading || pipelines.isLoading) return <Screen scroll={false}><LoadingState /></Screen>;
  if (events.isError || pipelines.isError) {
    return <Screen><ErrorState error={events.error ?? pipelines.error} onRetry={() => { void events.refetch(); void pipelines.refetch(); }} /></Screen>;
  }
  if (!item) return <Screen><EmptyState title="Applicant unavailable" body="Refresh the pipeline and try again." /></Screen>;

  return (
    <Screen>
      <Eyebrow>{item.opportunity_title}</Eyebrow>
      <Display>{item.volunteer_name}</Display>
      <View className="mb-6 mt-4 self-start rounded-full bg-secondary px-4 py-2 dark:bg-dark-secondary">
        <Text className="font-mono text-xs uppercase text-secondary-foreground dark:text-dark-secondary-foreground">{statusLabel[item.status]}</Text>
      </View>
      <DetailCard className="mb-4" title="Volunteer note" value={item.note} />
      <DetailCard className="mb-4" title="Experience" value={item.experience || "No additional experience provided."} />
      <DetailCard className="mb-4" title="Contact and availability" value={`${item.volunteer_email}\n${item.availability}`} />
      <WaiverSummary waiver={item.waiver} />
      {transition.error ? <Text accessibilityRole="alert" className="mb-3 font-sans text-sm text-destructive dark:text-dark-destructive">{transition.error.message}</Text> : null}
      <Button label="Accept volunteer" onPress={() => transition.mutate("confirmed")} loading={transition.isPending} />
      <Button label="Keep under review" variant="secondary" className="mt-3" disabled={transition.isPending} onPress={() => transition.mutate("under_review")} />
      <Button label="Offer a waitlist place" variant="secondary" className="mt-3" disabled={transition.isPending} onPress={() => transition.mutate("waitlisted")} />
      <Button label="Decline application" variant="danger" className="mt-3" disabled={transition.isPending} onPress={() => transition.mutate("declined")} />
    </Screen>
  );
}
