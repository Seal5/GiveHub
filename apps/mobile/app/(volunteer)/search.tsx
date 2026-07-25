import { useState } from "react";
import { FlatList, Pressable, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { Chip, EmptyState, LoadingState } from "@/components/ui";
import { EventCard } from "@/components/EventCard";

export default function SearchScreen() {
  const [search, setSearch] = useState("");
  const [cause, setCause] = useState("");
  const [recurrence, setRecurrence] = useState("");
  const { token } = useAuth();
  const query = useQuery({ queryKey: ["opportunities", search, cause, recurrence], queryFn: () => api.opportunities({ q: search, cause, recurrence }, token) });
  return (
    <View className="flex-1 bg-paper pt-14 dark:bg-night">
      <View className="px-5">
        <View className="mb-4 flex-row items-center gap-3">
          <Pressable accessibilityLabel="Back" onPress={() => router.back()} className="h-12 w-12 items-center justify-center rounded-full border border-ink/10 dark:border-paper/10"><Ionicons name="arrow-back" size={21} color="#2D945D" /></Pressable>
          <View className="min-h-14 flex-1 flex-row items-center rounded-2xl bg-white px-4 dark:bg-white/5"><Ionicons name="search" size={20} color="#2D945D" /><TextInput autoFocus accessibilityLabel="Search opportunities" placeholder="Search nearby" placeholderTextColor="#829087" value={search} onChangeText={setSearch} className="ml-3 flex-1 font-sans text-base text-ink dark:text-paper" /></View>
        </View>
        <FlatList horizontal showsHorizontalScrollIndicator={false} data={["", "cleanup", "planting", "monitoring", "community"]} keyExtractor={(item) => item || "all"} renderItem={({ item }) => <Chip label={item ? item[0]!.toUpperCase() + item.slice(1) : "All causes"} selected={cause === item} onPress={() => setCause(item)} />} className="mb-3" />
        <FlatList horizontal showsHorizontalScrollIndicator={false} data={["", "one_off", "weekly", "monthly"]} keyExtractor={(item) => item || "any"} renderItem={({ item }) => <Chip label={item ? item.replace("_", " ") : "Any frequency"} selected={recurrence === item} onPress={() => setRecurrence(item)} />} />
      </View>
      {query.isLoading ? <LoadingState /> : <FlatList className="mt-5 px-5" contentContainerClassName="pb-20" data={query.data} keyExtractor={(item) => item.id} renderItem={({ item }) => <EventCard item={item} compact />} ListEmptyComponent={<EmptyState title="No close matches" body="Try a broader phrase or remove a filter." />} />}
    </View>
  );
}

