import { useEffect, useState } from "react";
import { FlatList, Platform, Share, Text, View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ApplicationStatus } from "@/lib/types";
import { useAuth } from "@/providers/AuthProvider";
import { Body, Button, Card, Chip, Display, EmptyState, Eyebrow, Field, LoadingState, Screen } from "@/components/ui";
import { StatusCard } from "@/components/StatusCard";

const stages: ApplicationStatus[] = ["received", "under_review", "confirmed", "waitlisted"];

async function deliverCsv(csv: string, fileName: string) {
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return;
  }
  await Share.share({ title: fileName, message: csv });
}

export default function PipelineScreen() {
  const { token } = useAuth(); const [eventId, setEventId] = useState(""); const [stage, setStage] = useState<ApplicationStatus | null>(null);
  const [search, setSearch] = useState(""); const [availability, setAvailability] = useState("");
  const [preparedCsv, setPreparedCsv] = useState<string | null>(null);
  const events = useQuery({ queryKey: ["organiser", "events"], queryFn: () => api.organiserOpportunities(token) });
  useEffect(() => { if (!eventId && events.data?.[0]) setEventId(events.data[0].id); }, [eventId, events.data]);
  useEffect(() => setPreparedCsv(null), [availability, eventId, search, stage]);
  const filters = { stage: stage ?? undefined, q: search, availability };
  const pipeline = useQuery({ queryKey: ["pipeline", eventId, filters], queryFn: () => api.pipeline(eventId, token, filters), enabled: Boolean(eventId) });
  const analytics = useQuery({ queryKey: ["analytics", eventId], queryFn: () => api.opportunityAnalytics(eventId, token), enabled: Boolean(eventId) });
  const selectedEvent = events.data?.find((item) => item.id === eventId);
  const exportFileName = `${`${selectedEvent?.title ?? "givehub"}-applicants`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}.csv`;
  const exportCsv = useMutation({
    mutationFn: () => api.exportApplications(eventId, filters, token),
    onSuccess: (csv) => Platform.OS === "web" ? setPreparedCsv(csv) : deliverCsv(csv, exportFileName),
  });
  if (events.isLoading) return <Screen scroll={false}><LoadingState /></Screen>;
  const visible = pipeline.data?.applications ?? [];
  const total = pipeline.data ? Object.values(pipeline.data.counts).reduce((sum, count) => sum + count, 0) : 0;
  return <Screen><Eyebrow>Application pipeline</Eyebrow><Display className="text-[30px] leading-8">Review one person at a time.</Display><Text className="mb-3 mt-6 font-strong text-sm text-foreground dark:text-dark-foreground">Opportunity</Text><FlatList horizontal showsHorizontalScrollIndicator={false} data={events.data} keyExtractor={(item) => item.id} renderItem={({ item }) => <Chip label={item.title} selected={eventId === item.id} onPress={() => setEventId(item.id)} />} />
    <Card className="mt-6">
      <Text className="font-display text-xl text-foreground dark:text-dark-foreground">Posting performance</Text>
      <View className="mt-4 flex-row justify-between">
        <View><Text className="font-display text-2xl text-primary dark:text-dark-primary">{analytics.data?.views ?? 0}</Text><Body>Views</Body></View>
        <View><Text className="font-display text-2xl text-primary dark:text-dark-primary">{analytics.data?.application_starts ?? 0}</Text><Body>Starts</Body></View>
        <View><Text className="font-display text-2xl text-primary dark:text-dark-primary">{analytics.data?.applications_submitted ?? 0}</Text><Body>Applied</Body></View>
        <View><Text className="font-display text-2xl text-primary dark:text-dark-primary">{analytics.data?.view_to_application_rate ?? 0}%</Text><Body>Conversion</Body></View>
      </View>
    </Card>
    <Text className="mb-3 mt-6 font-strong text-sm text-foreground dark:text-dark-foreground">Stage</Text>
    <View className="flex-row">
      <Chip label={`all ${total}`} selected={stage === null} onPress={() => setStage(null)} />
      <FlatList horizontal showsHorizontalScrollIndicator={false} data={stages} keyExtractor={(item) => item} renderItem={({ item }) => <Chip label={`${item.replace("_", " ")} ${pipeline.data?.counts[item] ?? 0}`} selected={stage === item} onPress={() => setStage(item)} />} />
    </View>
    <View className="mt-5">
      <Field label="Search name, email, skills or notes" value={search} onChangeText={setSearch} placeholder="e.g. first aid or Spanish" />
      <Field label="Availability contains" value={availability} onChangeText={setAvailability} placeholder="e.g. daytime or full event" />
    </View>
    <Card className="mt-2">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-4">
          <Text className="font-display text-xl text-foreground dark:text-dark-foreground">Applicant database</Text>
          <Body className="mt-1">{visible.length} filtered {visible.length === 1 ? "row" : "rows"} ready to export</Body>
        </View>
        <View className="rounded-full bg-secondary px-3 py-2 dark:bg-dark-secondary">
          <Text className="font-strong text-xs text-primary dark:text-dark-primary">{visible.length}</Text>
        </View>
      </View>
      {pipeline.isLoading ? <View className="py-6"><LoadingState /></View> : visible.length ? (
        <View className="mt-4 overflow-hidden rounded-xl border border-border dark:border-dark-border">
          {visible.slice(0, 5).map((item, index) => (
            <View key={item.id} className={`p-3 ${index ? "border-t border-border dark:border-dark-border" : ""}`}>
              <View className="flex-row items-center justify-between">
                <Text className="flex-1 font-strong text-sm text-foreground dark:text-dark-foreground">{item.volunteer_name}</Text>
                <Text className="ml-3 rounded-full bg-secondary px-2 py-1 font-strong text-[10px] uppercase text-primary dark:bg-dark-secondary dark:text-dark-primary">{item.status.replace("_", " ")}</Text>
              </View>
              <Text className="mt-1 font-sans text-xs text-muted-foreground dark:text-dark-muted-foreground">{item.volunteer_email}</Text>
              <Text className="mt-1 font-sans text-xs text-muted-foreground dark:text-dark-muted-foreground">{item.availability}</Text>
            </View>
          ))}
          {visible.length > 5 ? <Text className="border-t border-border p-3 text-center font-strong text-xs text-primary dark:border-dark-border dark:text-dark-primary">+ {visible.length - 5} more rows in the export</Text> : null}
        </View>
      ) : <Body className="mt-4">No rows match the current filters.</Body>}
      <Button
        className="mt-4"
        label={Platform.OS === "web" && preparedCsv ? `Download ${visible.length} rows (CSV)` : `Prepare ${visible.length} filtered ${visible.length === 1 ? "row" : "rows"} (CSV)`}
        variant="secondary"
        loading={exportCsv.isPending}
        disabled={!visible.length}
        onPress={() => {
          if (Platform.OS === "web" && preparedCsv) void deliverCsv(preparedCsv, exportFileName);
          else exportCsv.mutate();
        }}
      />
      {Platform.OS === "web" && preparedCsv ? <Body className="mt-3 text-center">Your filtered CSV is ready to download.</Body> : null}
      {exportCsv.error ? <Text className="mt-3 font-sans text-sm text-destructive dark:text-dark-destructive">{exportCsv.error.message}</Text> : null}
    </Card>
    <Text className="mb-3 mt-7 font-strong text-sm text-foreground dark:text-dark-foreground">Review queue</Text>
    <View>{pipeline.isLoading ? <LoadingState /> : visible.length ? visible.map((item) => <StatusCard key={item.id} item={item} organiser />) : <EmptyState title="No people in this stage" body="Applications will move here as you make decisions." />}</View>
  </Screen>;
}
