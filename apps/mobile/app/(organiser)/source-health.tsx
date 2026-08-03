import { Text, View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Body, Button, Card, Display, EmptyState, ErrorState, Eyebrow, LoadingState, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" }) : "Not recorded yet";
}

function Metric({ value, label }: { value: number; label: string }) {
  return <Card className="mb-3 w-[48.5%] p-4"><Text className="font-display text-[28px] text-primary dark:text-dark-primary">{value}</Text><Body className="mt-1">{label}</Body></Card>;
}

export default function SourceHealthScreen() {
  const { token } = useAuth();
  const health = useQuery({ queryKey: ["source-health"], queryFn: () => api.sourceHealth(token), refetchInterval: 5000 });
  const refresh = useMutation({
    mutationFn: () => api.startSourceRefresh(token),
    onSuccess: () => setTimeout(() => void health.refetch(), 750),
  });
  if (health.isLoading) return <Screen scroll={false}><LoadingState label="Checking source health…" /></Screen>;
  if (health.isError) return <Screen><ErrorState title="Source health unavailable" error={health.error} onRetry={() => health.refetch()} /></Screen>;
  const data = health.data!;
  return (
    <Screen refreshing={health.isRefetching} onRefresh={() => void health.refetch()}>
      <Eyebrow>Source operations</Eyebrow>
      <Display>Keep imported opportunities fresh.</Display>
      <Body className="mt-3">{data.schedule} · next run {formatDate(data.next_scheduled_at)}</Body>
      <View className="mt-6 flex-row flex-wrap justify-between">
        <Metric value={data.pending_candidates} label="Pending review" />
        <Metric value={data.stale_listings} label="Stale listings" />
      </View>
      {refresh.error ? <Text accessibilityRole="alert" className="mb-3 font-sans text-sm text-destructive dark:text-dark-destructive">{refresh.error.message}</Text> : null}
      <Button label={data.refresh_in_progress ? "Refresh in progress" : "Run refresh now"} disabled={data.refresh_in_progress} loading={refresh.isPending} onPress={() => refresh.mutate()} />
      <Body className="mb-7 mt-2">Manual refreshes use the same bounded GTA source checks as the nightly job. They never publish new discoveries automatically.</Body>

      <Text className="mb-3 font-display text-2xl text-foreground dark:text-dark-foreground">Sources</Text>
      {!data.sources.length ? <EmptyState title="No sources yet" body="Source health appears after external listings or candidates are added." /> : data.sources.map((source) => (
        <Card key={source.name} className="mb-3 p-4">
          <Text className="font-strong text-base text-foreground dark:text-dark-foreground">{source.name}</Text>
          <Body className="mt-2">{source.active_listings} active listings · {source.pending_candidates} pending candidates</Body>
          <Body className="mt-2">Last checked: {formatDate(source.last_checked_at)}</Body>
          {source.last_seen_at ? <Body>Latest candidate seen: {formatDate(source.last_seen_at)}</Body> : null}
        </Card>
      ))}

      <Text className="mb-3 mt-5 font-display text-2xl text-foreground dark:text-dark-foreground">Recent refreshes</Text>
      {!data.recent_runs.length ? <EmptyState title="No refresh history" body="The next scheduled or manual refresh will appear here." /> : data.recent_runs.map((run) => (
        <Card key={run.id} className="mb-3 p-4">
          <View className="flex-row items-center justify-between gap-3">
            <Text className="font-strong text-base capitalize text-foreground dark:text-dark-foreground">{run.status}</Text>
            <Text className="font-strong text-xs uppercase text-primary dark:text-dark-primary">{run.trigger}</Text>
          </View>
          <Body className="mt-2">{formatDate(run.completed_at ?? run.started_at)}</Body>
          <Body className="mt-3">Found {run.discovered} · added {run.candidates_added} · updated {run.candidates_updated} · checked {run.checked}</Body>
          <Body>Expired {run.expired} · unavailable {run.unavailable} · failed {run.failed}</Body>
          {run.error_summary ? <Text accessibilityRole="alert" className="mt-3 font-sans text-sm text-destructive dark:text-dark-destructive">{run.error_summary}</Text> : null}
        </Card>
      ))}
    </Screen>
  );
}
