import { useEffect, useState } from "react";
import { FlatList, Platform, Share, Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ApplicationStatus } from "@/lib/types";
import { useAuth } from "@/providers/AuthProvider";
import { Body, Button, Card, Chip, Display, EmptyState, ErrorState, Eyebrow, Field, LoadingState, Screen } from "@/components/ui";
import { StatusCard } from "@/components/StatusCard";
import { ApplicantWorkspace } from "@/components/ApplicantWorkspace";
import { shareOpportunity } from "@/lib/share";

const stages: ApplicationStatus[] = ["received", "under_review", "confirmed", "waitlisted", "declined", "withdrawn"];

async function deliverCsv(csv: string, fileName: string) {
  if (Platform.OS !== "web") { await Share.share({ title: fileName, message: csv }); return; }
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = fileName;
  document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}

export default function PipelineScreen() {
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 900;
  const { token } = useAuth();
  const [eventId, setEventId] = useState("");
  const [stage, setStage] = useState<ApplicationStatus | null>(null);
  const [search, setSearch] = useState("");
  const [availability, setAvailability] = useState("");
  const [preparedCsv, setPreparedCsv] = useState<string | null>(null);
  const events = useQuery({ queryKey: ["organiser", "events"], queryFn: () => api.organiserOpportunities(token) });
  useEffect(() => { if (!eventId && events.data?.[0]) setEventId(events.data[0].id); }, [events.data, eventId]);
  useEffect(() => setPreparedCsv(null), [eventId, stage, search, availability]);
  const filters = { stage: stage ?? undefined, q: search.trim() || undefined, availability: availability.trim() || undefined };
  const pipeline = useQuery({ queryKey: ["pipeline", eventId, filters], queryFn: () => api.pipeline(eventId, token, filters), enabled: Boolean(eventId) });
  const analytics = useQuery({ queryKey: ["opportunity-analytics", eventId], queryFn: () => api.opportunityAnalytics(eventId, token), enabled: Boolean(eventId) });
  const selected = events.data?.find(e => e.id === eventId);
  const visible = pipeline.data?.applications ?? [];
  const fileName = `${(selected?.title ?? "givehub").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-applicants.csv`;
  const exportCsv = useMutation({ mutationFn: () => api.exportApplications(eventId, filters, token), onSuccess: csv => { if (Platform.OS === "web") setPreparedCsv(csv); else void deliverCsv(csv, fileName); } });
  if (events.isLoading) return <Screen><LoadingState /></Screen>;
  if (events.isError) return <Screen><ErrorState error={events.error} onRetry={() => events.refetch()} /></Screen>;
  if (!events.data?.length) return <Screen><Display>Application pipeline</Display><EmptyState title="No opportunities yet" body="Prepare an opportunity and applicants will appear here after publication." /></Screen>;
  const total = Object.values(pipeline.data?.counts ?? {}).reduce((sum, count) => sum + count, 0);
  const metrics = [[analytics.data?.views ?? 0, "Views"], [analytics.data?.application_starts ?? 0, "Starts"], [analytics.data?.applications_submitted ?? 0, "Applied"], [analytics.data?.shares ?? 0, "Shares"], [`${analytics.data?.view_to_application_rate ?? 0}%`, "Conversion"]];
  return <Screen>
    <Eyebrow>Application pipeline</Eyebrow>
    <Display className="text-[30px] leading-8">{desktop ? "Review applicants and make the next step clear." : "Review one person at a time."}</Display>
    <Text className="mt-5 mb-3 font-strong text-sm text-foreground dark:text-dark-foreground">Opportunity</Text>
    <View className="w-full overflow-hidden"><FlatList horizontal showsHorizontalScrollIndicator={false} data={events.data} keyExtractor={item => item.id} renderItem={({ item }) => <Chip label={item.title} selected={eventId === item.id} onPress={() => setEventId(item.id)} />} /></View>
    <Card className="mt-5">
      <View className="flex-row justify-between">{metrics.map(([value, label]) => <View key={label} className="flex-1"><Text className="font-display text-2xl text-primary dark:text-dark-primary">{value}</Text><Body>{label}</Body></View>)}</View>
      {analytics.isError ? <Body className="mt-3">Performance data could not be loaded.</Body> : null}
      {selected ? <View className={desktop ? "mt-4 flex-row gap-3" : "mt-4 gap-3"}>
        <View className={desktop ? "w-64" : ""}><Button label="Take attendance" variant="secondary" onPress={() => router.push(`/(organiser)/attendance/${selected.id}`)} /></View>
        <View className={desktop ? "w-64" : ""}><Button label="Share opportunity" variant="secondary" onPress={() => void shareOpportunity(selected, token)} /></View>
      </View> : null}
    </Card>
    <View className="mt-5 flex-row flex-wrap gap-y-2"><Chip label={`All ${total}`} selected={!stage} onPress={() => setStage(null)} />{stages.map(value => <Chip key={value} label={`${value.replace("_", " ")} ${pipeline.data?.counts[value] ?? 0}`} selected={stage === value} onPress={() => setStage(value)} />)}</View>
    <View className={desktop ? "mt-4 flex-row gap-4" : "mt-4"}>
      <View className="flex-1"><Field label="Search name, email, skills or notes" value={search} onChangeText={setSearch} placeholder="e.g. first aid" /></View>
      <View className="flex-1"><Field label="Availability contains" value={availability} onChangeText={setAvailability} placeholder="e.g. full event" /></View>
    </View>
    {pipeline.isLoading ? <LoadingState /> : pipeline.isError ? <ErrorState error={pipeline.error} onRetry={() => pipeline.refetch()} /> : desktop ? <ApplicantWorkspace applications={visible} token={token} /> : visible.length ? visible.map(item => <StatusCard key={item.id} item={item} organiser />) : <EmptyState title="No people in this stage" body="Adjust the filters or wait for new applications." />}
    <Card className="mt-5">
      <Text className="font-strong text-base text-foreground dark:text-dark-foreground">Applicant export</Text>
      <Body className="mt-2 mb-3">{visible.length} filtered rows. The export contains applicant contact information; share it only with authorized staff.</Body>
      <Button variant="secondary" label={preparedCsv ? "Download filtered CSV" : "Prepare filtered CSV"} disabled={!visible.length} loading={exportCsv.isPending} onPress={() => preparedCsv ? void deliverCsv(preparedCsv, fileName) : exportCsv.mutate()} />
      {exportCsv.error ? <Text accessibilityRole="alert" className="mt-3 text-destructive dark:text-dark-destructive">{exportCsv.error.message}</Text> : null}
    </Card>
  </Screen>;
}
