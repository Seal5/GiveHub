import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import type { Application } from "@/lib/types";
import { statusLabel } from "@/lib/format";

const statusColour = { confirmed: "bg-moss", waitlisted: "bg-clay", declined: "bg-ink/50", withdrawn: "bg-ink/40" } as const;

export function StatusCard({ item, organiser = false }: { item: Application; organiser?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(organiser ? `/(organiser)/application/${item.id}` : `/(volunteer)/opportunity/${item.opportunity_id}`)} className="mb-4 rounded-card border border-ink/10 bg-white p-5 active:opacity-85 dark:border-paper/10 dark:bg-white/5">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="font-display text-xl text-ink dark:text-paper">{organiser ? item.volunteer_name : item.opportunity_title}</Text>
            <Text className="mt-2 font-sans text-sm text-ink/65 dark:text-paper/65">{organiser ? item.opportunity_title : item.next_step}</Text>
          </View>
          <View className={`rounded-full px-3 py-1 ${statusColour[item.status as keyof typeof statusColour] ?? "bg-fern"}`}>
            <Text className="font-mono text-[10px] uppercase text-ink">{statusLabel[item.status]}</Text>
          </View>
        </View>
    </Pressable>
  );
}
