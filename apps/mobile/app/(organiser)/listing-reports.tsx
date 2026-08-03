import { useState } from "react";
import { Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Body, Button, Card, Chip, Display, EmptyState, ErrorState, Eyebrow, Field, LoadingState, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import type { ListingReport } from "@/lib/types";
import { useAuth } from "@/providers/AuthProvider";

const statusOptions = ["pending", "dismissed", "resolved", "all"] as const;
const reasonLabels: Record<ListingReport["reason"], string> = {
  outdated: "Outdated information", cancelled: "Event cancelled", broken_link: "Broken application link",
  safety_accessibility: "Safety or access concern", duplicate: "Duplicate listing", spam: "Spam or inappropriate", other: "Other concern",
};

export default function ListingReportsScreen() {
  const { token } = useAuth();
  const client = useQueryClient();
  const [status, setStatus] = useState<(typeof statusOptions)[number]>("pending");
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const reports = useQuery({ queryKey: ["listing-reports", status], queryFn: () => api.listingReports(status, token) });
  const moderate = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "dismiss" | "resolve" | "unpublish" }) => api.moderateListingReport(id, { action, resolution_note: note }, token),
    onSuccess: async () => { setSelected(null); setNote(""); await client.invalidateQueries({ queryKey: ["listing-reports"] }); await client.invalidateQueries({ queryKey: ["opportunities"] }); },
  });

  if (reports.isLoading) return <Screen scroll={false}><LoadingState label="Loading listing reports…" /></Screen>;
  if (reports.isError) return <Screen><ErrorState title="Reports unavailable" error={reports.error} onRetry={() => reports.refetch()} /></Screen>;
  return (
    <Screen refreshing={reports.isRefetching} onRefresh={() => void reports.refetch()}>
      <Eyebrow>Trust and safety</Eyebrow>
      <Display>Review reported listings.</Display>
      <Body className="mb-6 mt-3">Check the opportunity and its source before deciding. Reporter names are shown only to authorised reviewers.</Body>
      <View className="mb-5 flex-row flex-wrap gap-y-2">
        {statusOptions.map((item) => <Chip key={item} label={item[0]!.toUpperCase() + item.slice(1)} selected={status === item} onPress={() => { setStatus(item); setSelected(null); }} />)}
      </View>
      {!reports.data?.length ? <EmptyState title="No reports here" body="There are no listing reports in this view." /> : reports.data.map((report) => (
        <Card key={report.id} className="mb-3 p-4">
          <Eyebrow>{reasonLabels[report.reason]}</Eyebrow>
          <Text className="font-strong text-base text-foreground dark:text-dark-foreground">{report.opportunity_title}</Text>
          <Body className="mt-1">{report.organisation_name} · reported by {report.reporter_name}</Body>
          <Body className="mt-3">{report.details || "No additional details were supplied."}</Body>
          {report.resolution_note ? <Body className="mt-3">Review note: {report.resolution_note}</Body> : null}
          {report.status === "pending" ? <Button className="mt-4" variant="secondary" label={selected === report.id ? "Close actions" : "Review report"} onPress={() => { setSelected(selected === report.id ? null : report.id); setNote(""); }} /> : null}
          {selected === report.id ? (
            <View className="mt-4 border-t border-border pt-4 dark:border-dark-border">
              <Field label="Review note (optional)" placeholder="Record what you checked or changed" value={note} onChangeText={setNote} />
              {moderate.error ? <Text accessibilityRole="alert" className="mb-3 font-sans text-sm text-destructive dark:text-dark-destructive">{moderate.error.message}</Text> : null}
              <Button label="Resolved — keep published" loading={moderate.isPending} onPress={() => moderate.mutate({ id: report.id, action: "resolve" })} />
              <Button className="mt-3" variant="secondary" label="Dismiss report" loading={moderate.isPending} onPress={() => moderate.mutate({ id: report.id, action: "dismiss" })} />
              <Button className="mt-3" variant="danger" label="Unpublish listing" loading={moderate.isPending} onPress={() => moderate.mutate({ id: report.id, action: "unpublish" })} />
            </View>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}
