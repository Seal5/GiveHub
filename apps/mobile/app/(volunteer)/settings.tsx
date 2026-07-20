import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import type { ThemePreference } from "@/lib/types";
import { Body, Button, Card, Chip, Display, Eyebrow, LoadingState, Screen } from "@/components/ui";

export default function SettingsScreen() {
  const { profile, token, signOut, refreshProfile } = useAuth(); const client = useQueryClient();
  const refs = useQuery({ queryKey: ["suburbs"], queryFn: api.suburbs });
  const [suburbId, setSuburbId] = useState(profile?.suburb?.id ?? "te-aro"); const [radius, setRadius] = useState(profile?.search_radius_km ?? 15); const [theme, setTheme] = useState<ThemePreference>(profile?.theme ?? "system");
  const save = useMutation({ mutationFn: () => api.updatePreferences({ suburb_id: suburbId, search_radius_km: radius, theme }, token), onSuccess: async () => { await refreshProfile(); client.invalidateQueries(); router.back(); } });
  if (refs.isLoading) return <Screen scroll={false}><LoadingState /></Screen>;
  return <Screen><Pressable accessibilityLabel="Close preferences" onPress={() => router.back()} className="mb-6 h-11 w-11 items-center justify-center rounded-full border border-ink/10 dark:border-paper/10"><Ionicons name="close" size={23} color="#2D945D" /></Pressable><Eyebrow>Volunteer preferences</Eyebrow><Display>Make every match feel possible.</Display><Body className="mb-7 mt-3">Your chosen suburb powers distance labels without asking for live device location.</Body>
    <Card className="mb-5"><Text className="mb-3 font-medium text-ink dark:text-paper">Search area</Text><View className="flex-row flex-wrap">{refs.data?.map((item) => <Chip key={item.id} label={item.name} selected={suburbId === item.id} onPress={() => setSuburbId(item.id)} />)}</View></Card>
    <Card className="mb-5"><Text className="mb-3 font-medium text-ink dark:text-paper">Travel radius</Text><View className="flex-row">{[5, 15, 30].map((value) => <Chip key={value} label={`${value} km`} selected={radius === value} onPress={() => setRadius(value)} />)}</View></Card>
    <Card className="mb-7"><Text className="mb-3 font-medium text-ink dark:text-paper">Appearance</Text><View className="flex-row">{(["system", "light", "dark"] as ThemePreference[]).map((value) => <Chip key={value} label={value} selected={theme === value} onPress={() => setTheme(value)} />)}</View></Card>
    <Button label="Save preferences" loading={save.isPending} onPress={() => save.mutate()} /><Button label="Sign out" variant="secondary" className="mt-3" onPress={async () => { await signOut(); router.replace("/"); }} />
  </Screen>;
}

