import { useEffect, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ApplicationStatus } from "@/lib/types";
import { useAuth } from "@/providers/AuthProvider";
import { Chip, Display, EmptyState, Eyebrow, LoadingState, Screen } from "@/components/ui";
import { StatusCard } from "@/components/StatusCard";

const stages: ApplicationStatus[] = ["received", "under_review", "confirmed", "waitlisted"];
export default function PipelineScreen() {
  const { token } = useAuth(); const [eventId, setEventId] = useState(""); const [stage, setStage] = useState<ApplicationStatus>("received");
  const events = useQuery({ queryKey: ["organiser", "events"], queryFn: () => api.organiserOpportunities(token) });
  useEffect(() => { if (!eventId && events.data?.[0]) setEventId(events.data[0].id); }, [eventId, events.data]);
  const pipeline = useQuery({ queryKey: ["pipeline", eventId], queryFn: () => api.pipeline(eventId, token), enabled: Boolean(eventId) });
  if (events.isLoading) return <Screen scroll={false}><LoadingState /></Screen>;
  const visible = pipeline.data?.applications.filter((item) => item.status === stage) ?? [];
  return <Screen><Eyebrow>Application pipeline</Eyebrow><Display>Review one person at a time.</Display><Text className="mb-3 mt-6 font-medium text-ink dark:text-paper">Opportunity</Text><FlatList horizontal showsHorizontalScrollIndicator={false} data={events.data} keyExtractor={(item) => item.id} renderItem={({ item }) => <Chip label={item.title} selected={eventId === item.id} onPress={() => setEventId(item.id)} />} />
    <Text className="mb-3 mt-6 font-medium text-ink dark:text-paper">Stage</Text><FlatList horizontal showsHorizontalScrollIndicator={false} data={stages} keyExtractor={(item) => item} renderItem={({ item }) => <Chip label={`${item.replace("_", " ")} ${pipeline.data?.counts[item] ?? 0}`} selected={stage === item} onPress={() => setStage(item)} />} />
    <View className="mt-6">{pipeline.isLoading ? <LoadingState /> : visible.length ? visible.map((item) => <StatusCard key={item.id} item={item} organiser />) : <EmptyState title="No people in this stage" body="Applications will move here as you make decisions." />}</View>
  </Screen>;
}

