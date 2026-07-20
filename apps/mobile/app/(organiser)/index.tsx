import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { Body, Button, Card, Display, Eyebrow, LoadingState, Screen } from "@/components/ui";

function Metric({ value, label }: { value: string; label: string }) {
  return <Card className="mb-3 w-[48%]"><Text className="font-display text-3xl text-moss">{value}</Text><Text className="mt-1 font-sans text-sm text-ink/60 dark:text-paper/60">{label}</Text></Card>;
}
export default function OrganiserOverview() {
  const { profile, token } = useAuth(); const events = useQuery({ queryKey: ["organiser", "events"], queryFn: () => api.organiserOpportunities(token) });
  if (events.isLoading) return <Screen scroll={false}><LoadingState /></Screen>;
  const filled = events.data?.reduce((sum, item) => sum + item.confirmed_count, 0) ?? 0;
  return <Screen><Eyebrow>{profile?.organisation_name}</Eyebrow><Display>Good work needs good coordination.</Display><Body className="mb-7 mt-3">See what needs attention before volunteers are left waiting.</Body>
    <View className="flex-row flex-wrap justify-between"><Metric value={String(filled)} label="Places filled" /><Metric value="3" label="Need a review" /><Metric value={String(events.data?.length ?? 0)} label="Upcoming events" /><Metric value="94%" label="Show-up rate" /></View>
    <View className="mb-4 mt-5 flex-row items-end justify-between"><View><Eyebrow>Action queue</Eyebrow><Text className="font-display text-3xl text-ink dark:text-paper">Move people forward</Text></View><Pressable onPress={() => router.push("/(organiser)/pipeline")}><Text className="font-medium text-moss">Open pipeline</Text></Pressable></View>
    <Card className="mb-5"><View className="flex-row items-center gap-4"><View className="h-12 w-12 items-center justify-center rounded-full bg-fern/50"><Ionicons name="people-outline" size={22} color="#2D945D" /></View><View className="flex-1"><Text className="font-medium text-lg text-ink dark:text-paper">3 new volunteer applications</Text><Body>{events.data?.[0]?.title ?? "Your latest opportunity"} · review today</Body></View><Ionicons name="chevron-forward" size={20} color="#2D945D" /></View></Card>
    <Button label="Create a new opportunity" icon={<Ionicons name="add" size={22} color="white" />} onPress={() => router.push("/(organiser)/create")} />
  </Screen>;
}

