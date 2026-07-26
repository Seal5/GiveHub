import { Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { Body, Button, Card, Display, EmptyState, ErrorState, Eyebrow, LoadingState, Screen, useThemeColours } from "@/components/ui";
import { formatEventDate } from "@/lib/format";

const formatHours = (hours: number) => (Number.isInteger(hours) ? `${hours}` : hours.toFixed(1));

function BigStat({ value, label, caption }: { value: string; label: string; caption?: string }) {
  return (
    <Card className="mb-3 w-[48.5%] p-4">
      <Text className="font-display text-[32px] leading-9 text-primary dark:text-dark-primary">{value}</Text>
      <Text className="mt-1 font-strong text-xs text-foreground dark:text-dark-foreground">{label}</Text>
      {caption ? <Text className="mt-0.5 font-sans text-xs text-muted-foreground dark:text-dark-muted-foreground">{caption}</Text> : null}
    </Card>
  );
}

export default function ImpactScreen() {
  const { token } = useAuth();
  const colours = useThemeColours();
  const query = useQuery({ queryKey: ["impact", "me"], queryFn: () => api.myImpact(token) });

  if (query.isLoading) return <Screen scroll={false}><LoadingState /></Screen>;
  if (query.isError) return <Screen><ErrorState error={query.error} onRetry={() => query.refetch()} /></Screen>;

  const impact = query.data;
  const nothingYet = !impact || impact.events_attended === 0;

  return (
    <Screen refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      <Eyebrow>Your impact</Eyebrow>
      <Display className="text-[30px] leading-8">The time you’ve actually given.</Display>
      <Body className="mb-7 mt-3">
        Hours appear here once a host marks you off at the event, so this is a record of what you
        turned up for, not what you signed up for.
      </Body>

      <View className="flex-row flex-wrap justify-between">
        <BigStat value={formatHours(impact?.total_hours ?? 0)} label="Hours contributed" caption={`${formatHours(impact?.hours_this_year ?? 0)} this year`} />
        <BigStat value={String(impact?.events_attended ?? 0)} label="Events attended" />
        <BigStat value={String(impact?.organisations_supported ?? 0)} label="Groups supported" />
        <BigStat value={String(impact?.upcoming_confirmed ?? 0)} label="Coming up" caption="Confirmed places" />
      </View>

      {nothingYet ? (
        <View className="mt-4">
          <EmptyState
            title="No hours logged yet"
            body="Once you attend an event and the host marks you off, your hours and causes will build up here."
          />
          <Button className="mt-4" label="Find something nearby" onPress={() => router.push("/(volunteer)/discover")} />
        </View>
      ) : (
        <>
          {impact.causes.length ? (
            <>
              <Text className="mb-3 mt-6 font-display text-2xl tracking-[-0.7px] text-foreground dark:text-dark-foreground">Where you’ve helped</Text>
              <Card className="mb-2">
                {impact.causes.map((cause, index) => (
                  <View key={cause.slug} className={`flex-row items-center justify-between py-3 ${index ? "border-t border-border dark:border-dark-border" : ""}`}>
                    <Text className="font-strong text-sm text-foreground dark:text-dark-foreground">{cause.name}</Text>
                    <Text className="font-sans text-xs text-muted-foreground dark:text-dark-muted-foreground">
                      {cause.events} {cause.events === 1 ? "event" : "events"}
                    </Text>
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          <Text className="mb-3 mt-6 font-display text-2xl tracking-[-0.7px] text-foreground dark:text-dark-foreground">Recent activity</Text>
          {impact.recent.map((entry) => (
            <Card key={`${entry.opportunity_id}-${entry.starts_at}`} className="mb-3">
              <View className="flex-row items-start gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-secondary dark:bg-dark-secondary">
                  <Ionicons name="checkmark-done" size={19} color={colours.primary} />
                </View>
                <View className="flex-1">
                  <Text className="font-strong text-sm text-foreground dark:text-dark-foreground">{entry.title}</Text>
                  <Body className="mt-1">{entry.organisation_name}</Body>
                  <Body>{formatEventDate(entry.starts_at)}</Body>
                </View>
                <Text className="font-display text-lg text-primary dark:text-dark-primary">{formatHours(entry.hours)}h</Text>
              </View>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
