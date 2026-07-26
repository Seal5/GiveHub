import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { Body, Button, Card, Display, EmptyState, Eyebrow, Field, LoadingState, Screen } from "@/components/ui";

export default function ManageOpportunityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const client = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [impact, setImpact] = useState("");
  const [tasks, setTasks] = useState("");
  const [meeting, setMeeting] = useState("");
  const [capacity, setCapacity] = useState("20");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const events = useQuery({ queryKey: ["organiser", "events"], queryFn: () => api.organiserOpportunities(token) });
  const item = events.data?.find((event) => event.id === id);
  const reports = useQuery({ queryKey: ["organiser", "reports", id], queryFn: () => api.opportunityReports(id, token), enabled: Boolean(item) });
  useEffect(() => {
    if (!item) return;
    setTitle(item.title); setDescription(item.description); setImpact(item.impact_statement);
    setTasks(item.tasks); setMeeting(item.meeting_point); setCapacity(String(item.capacity));
  }, [item]);
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["organiser"] });
    await client.invalidateQueries({ queryKey: ["opportunities"] });
    await client.invalidateQueries({ queryKey: ["opportunity", id] });
  };
  const update = useMutation({
    mutationFn: () => {
      if (!item) throw new Error("Opportunity is unavailable.");
      const places = Number(capacity);
      if (!Number.isInteger(places) || places < 1) throw new Error("Enter a valid capacity.");
      return api.updateOpportunity(id, { title, description, impact_statement: impact, tasks, meeting_point: meeting, capacity: places, version: item.version }, token);
    },
    onSuccess: refresh,
  });
  const statusChange = useMutation({
    mutationFn: (action: "publish" | "close" | "unpublish") => action === "publish" ? api.publishOpportunity(id, token) : action === "close" ? api.closeOpportunity(id, token) : api.unpublishOpportunity(id, token),
    onSuccess: refresh,
  });
  const remove = useMutation({ mutationFn: () => api.removeOpportunity(id, token), onSuccess: async () => { await refresh(); router.replace("/(organiser)"); } });
  if (events.isLoading) return <Screen scroll={false}><LoadingState /></Screen>;
  if (!item) return <Screen><EmptyState title="Opportunity unavailable" body="It may already have been removed." /></Screen>;
  const error = update.error ?? statusChange.error ?? remove.error;
  return <Screen>
    <Eyebrow>Manage post</Eyebrow><Display className="text-[30px] leading-8">{item.title}</Display>
    <View className="mt-4 self-start rounded-full bg-secondary px-3 py-2 dark:bg-dark-secondary"><Text className="font-strong text-xs uppercase text-primary dark:text-dark-primary">{item.status}</Text></View>
    <Card className="mt-6">
      <Text className="font-display text-xl text-foreground dark:text-dark-foreground">Edit opportunity</Text>
      <Body className="mb-5 mt-1">Changes use version checks so another organizer cannot silently overwrite newer edits.</Body>
      <Field label="Event title" value={title} onChangeText={setTitle} />
      <Field label="Description" value={description} onChangeText={setDescription} multiline numberOfLines={4} textAlignVertical="top" />
      <Field label="Impact statement" value={impact} onChangeText={setImpact} multiline numberOfLines={3} textAlignVertical="top" />
      <Field label="Volunteer tasks" value={tasks} onChangeText={setTasks} multiline numberOfLines={4} textAlignVertical="top" />
      <Field label="Arrival instructions" value={meeting} onChangeText={setMeeting} />
      <Field label="Volunteer places" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" />
      <Button label="Save edits" loading={update.isPending} onPress={() => update.mutate()} />
    </Card>
    <Card className="mt-5">
      <Text className="font-display text-xl text-foreground dark:text-dark-foreground">Publishing controls</Text>
      <Body className="mb-4 mt-1">Close keeps the post visible but stops applications. Unpublish hides it. Remove hides it permanently while preserving applicant history.</Body>
      {item.status === "published" ? <>
        <Button label="Close applications" variant="secondary" loading={statusChange.isPending} onPress={() => statusChange.mutate("close")} />
        <Button className="mt-3" label="Unpublish post" variant="secondary" loading={statusChange.isPending} onPress={() => statusChange.mutate("unpublish")} />
      </> : <Button label={item.status === "closed" ? "Reopen applications" : "Publish post"} loading={statusChange.isPending} onPress={() => statusChange.mutate("publish")} />}
      {!confirmRemove ? <Button className="mt-3" label="Remove post" variant="danger" onPress={() => setConfirmRemove(true)} /> : <View className="mt-3 rounded-card bg-destructive/10 p-4">
        <Text className="font-strong text-sm text-destructive dark:text-dark-destructive">Remove this post from GiveHub?</Text>
        <Body className="mb-3 mt-1">Applicant and status history will be retained for audit purposes.</Body>
        <Button label="Confirm removal" variant="danger" loading={remove.isPending} onPress={() => remove.mutate()} />
        <Button className="mt-2" label="Keep post" variant="secondary" onPress={() => setConfirmRemove(false)} />
      </View>}
      {error ? <Text className="mt-3 font-sans text-sm text-destructive dark:text-dark-destructive">{error.message}</Text> : null}
    </Card>
    <Card className="mt-5">
      <Text className="font-display text-xl text-foreground dark:text-dark-foreground">Volunteer reports · {reports.data?.length ?? 0}</Text>
      <Body className="mb-4 mt-1">Reports show the reason and details without exposing the volunteer’s identity.</Body>
      {reports.isLoading ? <LoadingState /> : reports.data?.length ? reports.data.map((report) => <View key={report.id} className="mb-3 rounded-xl bg-secondary p-4 last:mb-0 dark:bg-dark-secondary">
        <Text className="font-strong text-xs uppercase text-primary dark:text-dark-primary">{report.reason}</Text>
        <Body className="mt-1">{report.details || "No additional details provided."}</Body>
        <Text className="mt-2 font-sans text-[11px] text-muted-foreground dark:text-dark-muted-foreground">{new Date(report.created_at).toLocaleDateString()}</Text>
      </View>) : <Body>No open reports for this post.</Body>}
    </Card>
  </Screen>;
}
