import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import type { Application } from "@/lib/types";
import { statusLabel } from "@/lib/format";

const statusColour = { confirmed: "bg-primary", waitlisted: "bg-accent", declined: "bg-muted", withdrawn: "bg-muted" } as const;

export function StatusCard({ item, organiser = false }: { item: Application; organiser?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(organiser ? `/(organiser)/application/${item.id}` : `/(volunteer)/opportunity/${item.opportunity_id}`)} className="mb-4 rounded-card border border-border bg-card p-5 active:opacity-85 dark:border-dark-border dark:bg-dark-card">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="font-display text-xl text-foreground dark:text-dark-foreground">{organiser ? item.volunteer_name : item.opportunity_title}</Text>
            <Text className="mt-2 font-sans text-sm text-muted-foreground dark:text-dark-muted-foreground">{organiser ? item.opportunity_title : item.next_step}</Text>
          </View>
          <View className={`rounded-full px-3 py-1 ${statusColour[item.status as keyof typeof statusColour] ?? "bg-secondary"}`}>
            <Text className="font-strong text-[10px] uppercase text-foreground">{statusLabel[item.status]}</Text>
          </View>
        </View>
    </Pressable>
  );
}
