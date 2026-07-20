import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { Body, Card, Display, EmptyState, Eyebrow, LoadingState, Screen } from "@/components/ui";
import { EventCard } from "@/components/EventCard";

export default function VolunteerHome() {
  const { profile, token } = useAuth();
  const query = useQuery({ queryKey: ["opportunities", "home"], queryFn: () => api.opportunities({}, token) });
  if (query.isLoading) return <Screen scroll={false}><LoadingState /></Screen>;
  return (
    <Screen>
      <View className="mb-6 mt-2 flex-row items-center justify-between">
        <View><Eyebrow>Near {profile?.suburb?.name ?? "Te Aro"}, Wellington</Eyebrow><Text className="font-sans text-sm text-ink/60 dark:text-paper/60">Kia ora, {profile?.display_name.split(" ")[0]}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Open preferences" onPress={() => router.push("/(volunteer)/settings")} className="h-12 w-12 items-center justify-center rounded-full border border-ink/10 dark:border-paper/10"><Ionicons name="options-outline" size={22} color="#2D945D" /></Pressable>
      </View>
      <Display>Where will you make a difference?</Display>
      <Pressable accessibilityRole="search" onPress={() => router.push("/(volunteer)/search")} className="my-6 min-h-16 flex-row items-center rounded-2xl border border-ink/10 bg-white px-4 dark:border-paper/10 dark:bg-white/5">
        <Ionicons name="search" size={20} color="#2D945D" /><Text className="ml-3 flex-1 font-sans text-base text-ink/55 dark:text-paper/55">Search activities, causes or hosts</Text><Text className="font-mono text-[10px] uppercase text-moss">{profile?.suburb?.name ?? "Te Aro"}</Text>
      </Pressable>
      <Card className="mb-8 border-0 bg-fern/45">
        <Eyebrow>Your weekly pulse</Eyebrow><Body>{query.data?.length ?? 0} activities match your saved causes, free time, and travel radius.</Body>
        <Pressable onPress={() => router.push("/(volunteer)/discover")} className="mt-3 min-h-11 justify-center"><Text className="font-medium text-moss">See your matches →</Text></Pressable>
      </Card>
      <View className="mb-4 flex-row items-end justify-between"><View><Eyebrow>Coming up</Eyebrow><Text className="font-display text-3xl text-ink dark:text-paper">Your next good thing</Text></View><Pressable onPress={() => router.push("/(volunteer)/discover")}><Text className="font-medium text-moss">All</Text></Pressable></View>
      {query.data?.[0] ? <EventCard item={query.data[0]} /> : <EmptyState title="Nothing nearby yet" body="Try expanding your search radius in preferences." />}
    </Screen>
  );
}

