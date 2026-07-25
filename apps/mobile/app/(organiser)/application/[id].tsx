import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ApplicationStatus } from "@/lib/types";
import { useAuth } from "@/providers/AuthProvider";
import { Body, Button, Card, Display, EmptyState, Eyebrow, LoadingState, Screen } from "@/components/ui";
import { statusLabel } from "@/lib/format";

export default function ApplicantDetail() {
  const { id } = useLocalSearchParams<{ id: string }>(); const { token } = useAuth(); const client = useQueryClient();
  const events = useQuery({ queryKey: ["organiser", "events"], queryFn: () => api.organiserOpportunities(token) });
  const pipelines = useQuery({ queryKey: ["pipeline", "all", events.data?.map((item) => item.id)], enabled: Boolean(events.data?.length), queryFn: async () => { const results = await Promise.all((events.data ?? []).map((event) => api.pipeline(event.id, token))); return results.flatMap((item) => item.applications); } });
  const item = pipelines.data?.find((candidate) => candidate.id === id);
  const transition = useMutation({ mutationFn: (status: ApplicationStatus) => api.transition(id, status, item!.version, token), onSuccess: () => { client.invalidateQueries({ queryKey: ["pipeline"] }); router.replace("/(organiser)/pipeline"); } });
  if (events.isLoading || pipelines.isLoading) return <Screen scroll={false}><LoadingState /></Screen>;
  if (!item) return <Screen><EmptyState title="Applicant unavailable" body="Refresh the pipeline and try again." /></Screen>;
  return <Screen><Eyebrow>{item.opportunity_title}</Eyebrow><Display>{item.volunteer_name}</Display><View className="mb-6 mt-4 self-start rounded-full bg-fern px-4 py-2"><Text className="font-mono text-xs uppercase text-ink">{statusLabel[item.status]}</Text></View>
    <Card className="mb-4"><Text className="font-medium text-ink dark:text-paper">Volunteer note</Text><Body className="mt-2">{item.note}</Body></Card><Card className="mb-4"><Text className="font-medium text-ink dark:text-paper">Experience</Text><Body className="mt-2">{item.experience || "No additional experience provided."}</Body></Card><Card className="mb-7"><Text className="font-medium text-ink dark:text-paper">Contact and availability</Text><Body className="mt-2">{item.volunteer_email}{`\n`}{item.availability}</Body></Card>
    <Button label="Accept volunteer" onPress={() => transition.mutate("confirmed")} loading={transition.isPending} /><Button label="Keep under review" variant="secondary" className="mt-3" onPress={() => transition.mutate("under_review")} /><Button label="Offer a waitlist place" variant="secondary" className="mt-3" onPress={() => transition.mutate("waitlisted")} /><Button label="Decline application" variant="danger" className="mt-3" onPress={() => transition.mutate("declined")} />
  </Screen>;
}

