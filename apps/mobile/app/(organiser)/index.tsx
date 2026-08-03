import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { Body, BrandMark, Button, Card, ErrorState, LoadingState, Screen, useThemeColours } from "@/components/ui";
import { formatEventDate } from "@/lib/format";

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <Card className="mb-3 w-[48.5%] p-4">
      <Text className="font-display text-[30px] leading-9 text-primary dark:text-dark-primary">{value}</Text>
      <Text className="mt-1 font-sans text-xs text-muted-foreground dark:text-dark-muted-foreground">{label}</Text>
    </Card>
  );
}

function greeting(hour = new Date().getHours()) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function OrganiserOverview() {
  const { profile, token } = useAuth();
  const colours = useThemeColours();
  const events = useQuery({ queryKey: ["organiser", "events"], queryFn: () => api.organiserOpportunities(token) });
  const analytics = useQuery({ queryKey: ["organiser", "analytics"], queryFn: () => api.organiserAnalytics(token) });
  const reports = useQuery({ queryKey: ["listing-reports", "pending"], queryFn: () => api.listingReports("pending", token) });
  if (events.isLoading || analytics.isLoading || reports.isLoading) return <Screen scroll={false}><LoadingState /></Screen>;
  const organisation = profile?.organisation_name ?? "Your organisation";
  const refresh = () => { void events.refetch(); void analytics.refetch(); void reports.refetch(); };

  if (events.isError || analytics.isError || reports.isError) {
    return (
      <Screen className="px-5 pb-6 pt-3">
        <BrandMark />
        <View className="mt-8"><ErrorState error={events.error ?? analytics.error ?? reports.error} onRetry={refresh} /></View>
      </Screen>
    );
  }

  return (
    <Screen className="px-5 pb-6 pt-3" refreshing={events.isRefetching || analytics.isRefetching} onRefresh={refresh}>
      <View className="flex-row items-center justify-between">
        <BrandMark />
        <View className="h-10 w-10 items-center justify-center rounded-full bg-secondary dark:bg-dark-secondary">
          <Text className="font-strong text-xs text-secondary-foreground dark:text-dark-secondary-foreground">{organisation.slice(0, 2).toUpperCase()}</Text>
        </View>
      </View>

      <Text className="mt-7 font-strong text-xs uppercase tracking-[1.5px] text-primary dark:text-dark-primary">{organisation}</Text>
      <Text accessibilityRole="header" className="mt-2 font-display text-[30px] leading-8 tracking-[-1px] text-foreground dark:text-dark-foreground">{greeting()}, team.</Text>
      <Body className="mt-2">See what needs attention before volunteers are left waiting.</Body>

      <View className="mt-6 flex-row flex-wrap justify-between">
        <Metric value={String(analytics.data?.views ?? 0)} label="Opportunity views" />
        <Metric value={String(analytics.data?.application_starts ?? 0)} label="Application starts" />
        <Metric value={String(analytics.data?.applications_submitted ?? 0)} label="Applications" />
        <Metric value={String(analytics.data?.shares ?? 0)} label="Shares" />
        <Metric value={`${analytics.data?.view_to_application_rate ?? 0}%`} label="View-to-application" />
      </View>

      <View className="mt-5 flex-row items-center justify-between">
        <Text className="font-display text-2xl tracking-[-0.7px] text-foreground dark:text-dark-foreground">Action queue</Text>
        <Pressable onPress={() => router.push("/(organiser)/pipeline")} className="min-h-11 justify-center"><Text className="font-strong text-sm text-primary dark:text-dark-primary">Open pipeline</Text></Pressable>
      </View>
      <Pressable onPress={() => router.push("/(organiser)/pipeline")} accessibilityRole="button">
        <Card className="mt-1 p-4">
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-xl bg-secondary dark:bg-dark-secondary"><Ionicons name="people-outline" size={20} color={colours.primary} /></View>
            <View className="flex-1">
              <Text className="font-strong text-sm text-foreground dark:text-dark-foreground">{analytics.data?.applications_submitted ?? 0} volunteer applications</Text>
              <Text className="mt-1 font-sans text-xs text-muted-foreground dark:text-dark-muted-foreground">{events.data?.[0]?.title ?? "Your latest opportunity"} · filter or export the applicant list</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colours.primary} />
          </View>
        </Card>
      </Pressable>
      <Pressable onPress={() => router.push("/(organiser)/source-review")} accessibilityRole="button" accessibilityLabel="Review imported opportunities">
        <Card className="mt-3 p-4">
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-xl bg-secondary dark:bg-dark-secondary"><Ionicons name="cloud-download-outline" size={20} color={colours.primary} /></View>
            <View className="flex-1">
              <Text className="font-strong text-sm text-foreground dark:text-dark-foreground">Review imported opportunities</Text>
              <Text className="mt-1 font-sans text-xs text-muted-foreground dark:text-dark-muted-foreground">Check sources, remove duplicates, and finish listings before publishing</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colours.primary} />
          </View>
        </Card>
      </Pressable>
      <Pressable onPress={() => router.push("/(organiser)/source-health")} accessibilityRole="button" accessibilityLabel="Open source refresh health">
        <Card className="mt-3 p-4">
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-xl bg-secondary dark:bg-dark-secondary"><Ionicons name="pulse-outline" size={20} color={colours.primary} /></View>
            <View className="flex-1">
              <Text className="font-strong text-sm text-foreground dark:text-dark-foreground">Source refresh health</Text>
              <Text className="mt-1 font-sans text-xs text-muted-foreground dark:text-dark-muted-foreground">See nightly refreshes, source freshness, failures, and new candidates</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colours.primary} />
          </View>
        </Card>
      </Pressable>
      <Pressable onPress={() => router.push("/(organiser)/listing-reports")} accessibilityRole="button" accessibilityLabel="Review reported listings">
        <Card className="mt-3 p-4">
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-xl bg-secondary dark:bg-dark-secondary"><Ionicons name="flag-outline" size={20} color={colours.primary} /></View>
            <View className="flex-1">
              <Text className="font-strong text-sm text-foreground dark:text-dark-foreground">{reports.data?.length ?? 0} reported listings</Text>
              <Text className="mt-1 font-sans text-xs text-muted-foreground dark:text-dark-muted-foreground">Check incorrect, broken, cancelled, or unsafe opportunities</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colours.primary} />
          </View>
        </Card>
      </Pressable>

      <View className="mb-2 mt-7 flex-row items-center justify-between">
        <Text className="font-display text-2xl tracking-[-0.7px] text-foreground dark:text-dark-foreground">Your opportunities</Text>
        <Text className="font-sans text-xs text-muted-foreground dark:text-dark-muted-foreground">Tap to edit</Text>
      </View>
      {events.data?.map((event) => (
        <Pressable
          key={event.id}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${event.title}`}
          onPress={() => router.push({ pathname: "/(organiser)/create", params: { id: event.id } })}
          className="mb-3"
        >
          <Card className="p-4">
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-xl bg-secondary dark:bg-dark-secondary">
                <Ionicons name="calendar-outline" size={20} color={colours.primary} />
              </View>
              <View className="flex-1">
                <Text className="font-strong text-sm text-foreground dark:text-dark-foreground">{event.title}</Text>
                <Text className="mt-1 font-sans text-xs text-muted-foreground dark:text-dark-muted-foreground">{formatEventDate(event.starts_at)} · {event.status}</Text>
              </View>
              <Ionicons name="create-outline" size={19} color={colours.primary} />
            </View>
          </Card>
        </Pressable>
      ))}

      <Button className="mt-7" label="Create a new opportunity" icon={<Ionicons name="add" size={20} color={colours.primaryForeground} />} onPress={() => router.push("/(organiser)/create")} />
    </Screen>
  );
}
