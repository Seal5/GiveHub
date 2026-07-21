import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { Body, BrandMark, Button, Card, LoadingState, Screen } from "@/components/ui";

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <Card className="mb-3 w-[48.5%] p-4">
      <Text className="font-display text-[30px] leading-9 text-primary dark:text-dark-primary">{value}</Text>
      <Text className="mt-1 font-sans text-xs text-muted-foreground dark:text-dark-muted-foreground">{label}</Text>
    </Card>
  );
}

export default function OrganiserOverview() {
  const { profile, token } = useAuth();
  const events = useQuery({ queryKey: ["organiser", "events"], queryFn: () => api.organiserOpportunities(token) });
  if (events.isLoading) return <Screen scroll={false}><LoadingState /></Screen>;
  const filled = events.data?.reduce((sum, item) => sum + item.confirmed_count, 0) ?? 0;
  const organisation = profile?.organisation_name ?? "Your organisation";

  return (
    <Screen className="px-5 pb-6 pt-3">
      <View className="flex-row items-center justify-between">
        <BrandMark />
        <View className="h-10 w-10 items-center justify-center rounded-full bg-secondary dark:bg-dark-secondary">
          <Text className="font-strong text-xs text-secondary-foreground dark:text-dark-secondary-foreground">{organisation.slice(0, 2).toUpperCase()}</Text>
        </View>
      </View>

      <Text className="mt-7 font-strong text-xs uppercase tracking-[1.5px] text-primary dark:text-dark-primary">{organisation}</Text>
      <Text accessibilityRole="header" className="mt-2 font-display text-[30px] leading-8 tracking-[-1px] text-foreground dark:text-dark-foreground">Good morning, team.</Text>
      <Body className="mt-2">See what needs attention before volunteers are left waiting.</Body>

      <View className="mt-6 flex-row flex-wrap justify-between">
        <Metric value={String(filled)} label="Places filled" />
        <Metric value="3" label="Need a review" />
        <Metric value={String(events.data?.length ?? 0)} label="Upcoming events" />
        <Metric value="94%" label="Show-up rate" />
      </View>

      <View className="mt-5 flex-row items-center justify-between">
        <Text className="font-display text-2xl tracking-[-0.7px] text-foreground dark:text-dark-foreground">Action queue</Text>
        <Pressable onPress={() => router.push("/(organiser)/pipeline")} className="min-h-11 justify-center"><Text className="font-strong text-sm text-primary dark:text-dark-primary">Open pipeline</Text></Pressable>
      </View>
      <Pressable onPress={() => router.push("/(organiser)/pipeline")} accessibilityRole="button">
        <Card className="mt-1 p-4">
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-xl bg-secondary dark:bg-dark-secondary"><Ionicons name="people-outline" size={20} color="#2A8D58" /></View>
            <View className="flex-1">
              <Text className="font-strong text-sm text-foreground dark:text-dark-foreground">3 new volunteer applications</Text>
              <Text className="mt-1 font-sans text-xs text-muted-foreground dark:text-dark-muted-foreground">{events.data?.[0]?.title ?? "Your latest opportunity"} · review today</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#2A8D58" />
          </View>
        </Card>
      </Pressable>

      <Button className="mt-7" label="Create a new opportunity" icon={<Ionicons name="add" size={20} color="#F8FFF8" />} onPress={() => router.push("/(organiser)/create")} />
    </Screen>
  );
}
