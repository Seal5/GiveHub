import { Image, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { Opportunity } from "@/lib/types";
import { formatEventDate } from "@/lib/format";
import { opportunityImage } from "@/lib/localAssets";

export function EventCard({ item, compact = false }: { item: Opportunity; compact?: boolean }) {
  const recurrence = item.recurrence === "one_off" ? "One-off" : item.recurrence;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.title}`} onPress={() => router.push(`/(volunteer)/opportunity/${item.id}`)} className="mb-4 overflow-hidden rounded-feature border border-border bg-card active:opacity-90 dark:border-dark-border dark:bg-dark-card">
      <View className="relative">
        {opportunityImage(item.id, item.image_url) ? <Image source={opportunityImage(item.id, item.image_url)} className={compact ? "h-32 w-full" : "h-36 w-full"} resizeMode="cover" /> : <View className="h-36 bg-secondary dark:bg-dark-secondary" />}
        <View className="absolute left-3 top-3 rounded-full bg-black/45 px-3 py-1.5">
          <Text className="font-strong text-[10px] uppercase tracking-[1px] text-white">{recurrence}</Text>
        </View>
      </View>
      <View className="p-4">
        <Text className="font-display text-lg leading-6 tracking-[-0.4px] text-foreground dark:text-dark-foreground">{item.title}</Text>
        <Text className="mt-1 font-sans text-xs text-muted-foreground dark:text-dark-muted-foreground">{item.organisation_name}</Text>
        <View className="mt-3 flex-row items-center justify-between">
          <Text className="flex-1 font-sans text-xs text-muted-foreground dark:text-dark-muted-foreground">{formatEventDate(item.starts_at)} · {item.location_label}</Text>
          <View className="ml-3 flex-row items-center gap-1"><Ionicons name="navigate-outline" size={13} color="#657166" /><Text className="font-sans text-xs text-muted-foreground dark:text-dark-muted-foreground">{item.distance_km === null ? "—" : `${item.distance_km.toFixed(1)} km`}</Text></View>
        </View>
      </View>
    </Pressable>
  );
}
