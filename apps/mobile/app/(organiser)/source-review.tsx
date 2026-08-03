import { useEffect, useState } from "react";
import { Linking, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Body, Button, Card, Chip, Display, EmptyState, ErrorState, Eyebrow, Field, LoadingState, Screen, useThemeColours } from "@/components/ui";
import { api } from "@/lib/api";
import type { SourceCandidate } from "@/lib/types";
import { useAuth } from "@/providers/AuthProvider";

const statuses = [
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "Out of area", value: "out_of_area" },
  { label: "All", value: "all" },
];

export default function SourceReviewScreen() {
  const { token } = useAuth();
  const colours = useThemeColours();
  const client = useQueryClient();
  const [status, setStatus] = useState("pending");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SourceCandidate | null>(null);
  const [draft, setDraft] = useState({ title: "", organisation_name: "", location_label: "", summary: "" });
  const candidates = useQuery({
    queryKey: ["source-candidates", status, query],
    queryFn: () => api.sourceCandidates({ review_status: status, q: query.trim() || undefined }, token),
  });

  useEffect(() => {
    if (!selected) return;
    setDraft({ title: selected.title, organisation_name: selected.organisation_name, location_label: selected.location_label, summary: selected.summary });
  }, [selected]);

  const refresh = async () => {
    setSelected(null);
    await client.invalidateQueries({ queryKey: ["source-candidates"] });
  };
  const save = useMutation({ mutationFn: () => api.updateSourceCandidate(selected!.id, draft, token), onSuccess: refresh });
  const reject = useMutation({ mutationFn: () => api.rejectSourceCandidate(selected!.id, token), onSuccess: refresh });
  const promote = useMutation({
    mutationFn: (allowDuplicate: boolean) => api.promoteSourceCandidate(selected!.id, allowDuplicate, token),
    onSuccess: async (opportunity) => {
      await refresh();
      await client.invalidateQueries({ queryKey: ["organiser"] });
      router.push({ pathname: "/(organiser)/create", params: { id: opportunity.id } });
    },
  });
  const error = save.error ?? reject.error ?? promote.error;

  if (candidates.isLoading) return <Screen scroll={false}><LoadingState label="Loading imported opportunities…" /></Screen>;
  if (candidates.isError) return <Screen><ErrorState title="Review queue unavailable" error={candidates.error} onRetry={() => candidates.refetch()} /></Screen>;

  return (
    <Screen refreshing={candidates.isRefetching} onRefresh={() => void candidates.refetch()}>
      <Eyebrow>Source review</Eyebrow>
      <Display>Turn fresh finds into trusted listings.</Display>
      <Body className="mt-3">Nothing goes live automatically. Confirm the source and details, then complete the draft before publishing.</Body>

      <View className="mt-6">
        <Field label="Search queue" placeholder="Title, organisation, or location" value={query} onChangeText={setQuery} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5" contentContainerClassName="pr-5">
        {statuses.map((item) => <Chip key={item.label} label={item.label} selected={status === item.value} onPress={() => { setStatus(item.value); setSelected(null); }} />)}
      </ScrollView>

      {!candidates.data?.length ? <EmptyState title="Queue clear" body="No imported opportunities match this view." /> : candidates.data.map((candidate) => (
        <Card key={candidate.id} className="mb-3 p-4">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="font-strong text-base text-foreground dark:text-dark-foreground">{candidate.title}</Text>
              <Body className="mt-1">{candidate.organisation_name} · {candidate.location_label}</Body>
              <Text className="mt-2 font-strong text-xs uppercase tracking-[1px] text-primary dark:text-dark-primary">{candidate.source_name}</Text>
            </View>
            {candidate.duplicates.length ? <View className="rounded-full bg-amber-100 px-3 py-1 dark:bg-amber-950"><Text className="font-strong text-xs text-amber-800 dark:text-amber-200">Possible duplicate</Text></View> : null}
          </View>
          <Body className="mt-3">{candidate.summary || "No source summary provided."}</Body>
          <Button className="mt-4 min-h-11" variant="secondary" label={selected?.id === candidate.id ? "Close review" : "Review details"} onPress={() => setSelected(selected?.id === candidate.id ? null : candidate)} />

          {selected?.id === candidate.id ? (
            <View className="mt-5 border-t border-border pt-5 dark:border-dark-border">
              <Field label="Title" value={draft.title} onChangeText={(title) => setDraft((value) => ({ ...value, title }))} />
              <Field label="Organisation" value={draft.organisation_name} onChangeText={(organisation_name) => setDraft((value) => ({ ...value, organisation_name }))} />
              <Field label="Location" value={draft.location_label} onChangeText={(location_label) => setDraft((value) => ({ ...value, location_label }))} />
              <Field label="Summary" multiline numberOfLines={4} textAlignVertical="top" value={draft.summary} onChangeText={(summary) => setDraft((value) => ({ ...value, summary }))} />
              {candidate.duplicates.map((duplicate) => <Body key={duplicate.id} className="mb-2">Possible match: {duplicate.title} by {duplicate.organisation_name} ({duplicate.status})</Body>)}
              {error ? <Text accessibilityRole="alert" className="mb-3 font-sans text-sm text-destructive dark:text-dark-destructive">{error.message}</Text> : null}
              <Button variant="secondary" label="Open original source" icon={<Ionicons name="open-outline" size={18} color={colours.primary} />} onPress={() => void Linking.openURL(candidate.source_url)} />
              <Button className="mt-3" variant="secondary" label="Save corrections" loading={save.isPending} onPress={() => save.mutate()} />
              <Button className="mt-3" label={candidate.duplicates.length ? "Create draft anyway" : "Approve and complete draft"} loading={promote.isPending} onPress={() => promote.mutate(candidate.duplicates.length > 0)} />
              <Button className="mt-3" variant="danger" label="Reject candidate" loading={reject.isPending} onPress={() => reject.mutate()} />
            </View>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}
