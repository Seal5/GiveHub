import { Image, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { Opportunity } from "@/lib/types";
import { formatEventDate } from "@/lib/format";

export function EventCard({ item, compact = false }: { item: Opportunity; compact?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.title}`}
      onPress={() => router.push(`/(volunteer)/opportunity/${item.id}`)}
      className="mb-4 overflow-hidden rounded-card border border-ink/10 bg-white active:opacity-90 dark:border-paper/10 dark:bg-white/5"
    >
      {item.image_url ? <Image source={{ uri: item.image_url }} className={compact ? "h-32 w-full" : "h-48 w-full"} resizeMode="cover" /> : null}
      <View className="p-4">
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="font-mono text-xs uppercase tracking-wider text-moss dark:text-fern">{item.causes[0]?.name ?? "Community"}</Text>
          <Text className="font-sans text-sm text-ink/60 dark:text-paper/60">{item.distance_km?.toFixed(1)} km</Text>
        </View>
        <Text className="font-display text-xl leading-7 text-ink dark:text-paper">{item.title}</Text>
        <Text className="mt-2 font-sans text-sm text-ink/65 dark:text-paper/65">{formatEventDate(item.starts_at)} · {item.suburb.name}</Text>
        <View className="mt-3 flex-row items-center justify-between">
          <Text className="font-medium text-sm text-moss dark:text-fern">Explore this event</Text>
          <Ionicons name="arrow-forward" size={18} color="#2D945D" />
        </View>
      </View>
    </Pressable>
  );
}
