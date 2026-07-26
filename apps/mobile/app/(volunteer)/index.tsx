import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { Body, BrandMark, Card, EmptyState, LoadingState, Screen } from "@/components/ui";
import { EventCard } from "@/components/EventCard";

export default function VolunteerHome() {
  const { profile, token } = useAuth();
  const query = useQuery({ queryKey: ["opportunities", "home", profile?.search_latitude, profile?.search_longitude, profile?.search_radius_km], queryFn: () => api.opportunities({}, token) });
  const locationLabel = profile?.search_location_label ?? "Set location";
  const firstName = profile?.display_name.split(" ")[0] ?? "there";
  if (query.isLoading) return <Screen scroll={false}><LoadingState /></Screen>;
  return (
    <Screen className="px-5 pb-6 pt-3">
      <View className="flex-row items-center justify-between">
        <BrandMark />
        <Pressable accessibilityRole="button" accessibilityLabel="Open preferences" onPress={() => router.push("/(volunteer)/settings")} className="h-10 w-10 items-center justify-center rounded-full border border-border bg-card dark:border-dark-border dark:bg-dark-card">
          <Ionicons name="options-outline" size={19} color="#2A8D58" />
          <View className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border border-card bg-primary" />
        </Pressable>
      </View>

      <Text className="mt-7 font-sans text-sm text-muted-foreground dark:text-dark-muted-foreground">Kia ora, {firstName}</Text>
      <Text accessibilityRole="header" className="mt-1 font-display text-[34px] leading-[36px] tracking-[-1.2px] text-foreground dark:text-dark-foreground">
        Where will your hands{`\n`}make a difference?
      </Text>

      <Pressable accessibilityRole="search" onPress={() => router.push("/(volunteer)/search")} className="mt-5 min-h-[52px] flex-row items-center rounded-card border border-border bg-card px-4 dark:border-dark-border dark:bg-dark-card">
        <Ionicons name="search" size={19} color="#2A8D58" />
        <Text className="ml-3 flex-1 font-sans text-sm text-muted-foreground dark:text-dark-muted-foreground">Search activities, causes or hosts</Text>
        <Text numberOfLines={1} className="max-w-20 font-strong text-[10px] uppercase text-primary dark:text-dark-primary">{locationLabel}</Text>
      </Pressable>

      <Card className="mt-6 rounded-[27px] border-primary/20 bg-secondary p-5 dark:border-dark-primary/20 dark:bg-dark-secondary">
        <View className="flex-row items-start gap-3">
          <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary/10 dark:bg-dark-primary/10">
            <Ionicons name="sparkles-outline" size={18} color="#2A8D58" />
          </View>
          <View className="flex-1">
            <Text className="font-strong text-xs uppercase tracking-[1.5px] text-primary dark:text-dark-primary">Your weekly pulse</Text>
            <Body className="mt-2 text-foreground/70 dark:text-dark-foreground/75">{query.data?.length ?? 0} activities match your causes, free time, and {profile?.search_radius_km ?? 25} km travel radius.</Body>
            <Pressable onPress={() => router.push("/(volunteer)/discover")} className="mt-3 min-h-11 flex-row items-center">
              <Text className="font-strong text-sm text-primary dark:text-dark-primary">See your matches</Text>
              <Ionicons className="ml-2" name="arrow-forward" size={17} color="#2A8D58" />
            </Pressable>
          </View>
        </View>
      </Card>

      <View className="mb-4 mt-8 flex-row items-center justify-between">
        <Text className="font-display text-2xl tracking-[-0.7px] text-foreground dark:text-dark-foreground">Coming up</Text>
        <Pressable onPress={() => router.push("/(volunteer)/discover")} className="min-h-11 justify-center px-2"><Text className="font-strong text-sm text-primary dark:text-dark-primary">See all</Text></Pressable>
      </View>
      {query.data?.[0] ? <EventCard item={query.data[0]} /> : <EmptyState title="Nothing nearby yet" body="Try expanding your search radius in preferences." />}
    </Screen>
  );
}
