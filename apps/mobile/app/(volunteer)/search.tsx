import { useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { Chip, EmptyState, ErrorState, IconButton, LoadingState, useThemeColours } from "@/components/ui";
import { EventCard } from "@/components/EventCard";

export default function SearchScreen() {
  const [search, setSearch] = useState("");
  const [cause, setCause] = useState("");
  const [recurrence, setRecurrence] = useState("");
  const { profile, token } = useAuth();
  const colours = useThemeColours();
  const query = useQuery({ queryKey: ["opportunities", search, cause, recurrence, profile?.search_latitude, profile?.search_longitude, profile?.search_radius_km], queryFn: () => api.opportunities({ q: search, cause, recurrence }, token) });
  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background dark:bg-dark-background">
      <View className="px-5 pt-3">
        <View className="mb-4 flex-row items-center gap-3">
          <IconButton icon="arrow-back" label="Back" onPress={() => router.back()} />
          <View className="min-h-14 flex-1 flex-row items-center rounded-card border border-border bg-card px-4 dark:border-dark-border dark:bg-dark-card">
            <Ionicons name="search" size={20} color={colours.primary} />
            <TextInput
              autoFocus
              accessibilityLabel="Search opportunities"
              placeholder="Search nearby"
              placeholderTextColor={colours.mutedForeground}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
              className="ml-3 flex-1 font-sans text-base text-foreground dark:text-dark-foreground"
            />
          </View>
        </View>
        <FlatList horizontal showsHorizontalScrollIndicator={false} data={["", "cleanup", "planting", "monitoring", "community"]} keyExtractor={(item) => item || "all"} renderItem={({ item }) => <Chip label={item ? item[0]!.toUpperCase() + item.slice(1) : "All causes"} selected={cause === item} onPress={() => setCause(item)} />} className="mb-3 grow-0" />
        <FlatList horizontal showsHorizontalScrollIndicator={false} data={["", "one_off", "weekly", "monthly"]} keyExtractor={(item) => item || "any"} renderItem={({ item }) => <Chip label={item ? item.replace("_", " ") : "Any frequency"} selected={recurrence === item} onPress={() => setRecurrence(item)} />} className="grow-0" />
        <Pressable accessibilityRole="button" onPress={() => router.push("/(volunteer)/settings")} className="mt-3 min-h-11 flex-row items-center">
          <Ionicons name="location-outline" size={18} color={colours.primary} />
          <Text className="ml-2 font-sans text-sm text-primary dark:text-dark-primary">Within {profile?.search_radius_km ?? 25} km of {profile?.search_location_label ?? "your chosen location"}</Text>
        </Pressable>
      </View>
      {query.isLoading ? <LoadingState /> : query.isError ? (
        <View className="px-5 pt-6"><ErrorState error={query.error} onRetry={() => query.refetch()} /></View>
      ) : (
        <FlatList
          className="mt-5 px-5"
          contentContainerClassName="pb-20"
          keyboardShouldPersistTaps="handled"
          data={query.data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <EventCard item={item} compact />}
          ListEmptyComponent={<EmptyState title="No close matches" body="Try a broader phrase or remove a filter." />}
        />
      )}
    </SafeAreaView>
  );
}
