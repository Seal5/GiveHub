import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LocationPicker } from "@/components/LocationPicker";
import { api } from "@/lib/api";
import type { LocationPoint, ThemePreference } from "@/lib/types";
import { useAuth } from "@/providers/AuthProvider";
import { Body, Button, Card, Chip, Display, Eyebrow, Screen } from "@/components/ui";

export default function SettingsScreen() {
  const { profile, token, signOut, refreshProfile } = useAuth();
  const client = useQueryClient();
  const initialLocation = profile?.search_latitude !== null && profile?.search_latitude !== undefined && profile.search_longitude !== null && profile.search_longitude !== undefined
    ? { label: profile.search_location_label ?? "Saved location", address_line: profile.search_location_label ?? "", locality: "", city: "", postcode: null, country_code: "NZ", latitude: profile.search_latitude, longitude: profile.search_longitude }
    : null;
  const [location, setLocation] = useState<LocationPoint | null>(initialLocation);
  const [radius, setRadius] = useState(profile?.search_radius_km ?? 25);
  const [theme, setTheme] = useState<ThemePreference>(profile?.theme ?? "system");
  const [validationError, setValidationError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => {
      if (!location) throw new Error("Choose a location or use your current location.");
      return api.updatePreferences({ search_location_label: location.label, search_latitude: location.latitude, search_longitude: location.longitude, search_radius_km: radius, theme }, token);
    },
    onSuccess: async () => { await refreshProfile(); await client.invalidateQueries(); router.back(); },
  });
  return <Screen>
    <Pressable accessibilityLabel="Close preferences" onPress={() => router.back()} className="mb-6 h-11 w-11 items-center justify-center rounded-full border border-ink/10 dark:border-paper/10"><Ionicons name="close" size={23} color="#2D945D" /></Pressable>
    <Eyebrow>Volunteer preferences</Eyebrow><Display>Find something worth showing up for.</Display>
    <Body className="mb-7 mt-3">Choose where to search and how far you are willing to travel. Your live location is never tracked in the background.</Body>
    <LocationPicker value={location} onChange={(next) => { setLocation(next); setValidationError(null); }} token={token} />
    <Card className="mb-5"><Text className="mb-3 font-medium text-ink dark:text-paper">Travel radius</Text><View className="flex-row flex-wrap">{[5, 10, 25, 50, 100].map((value) => <Chip key={value} label={`${value} km`} selected={radius === value} onPress={() => setRadius(value)} />)}</View></Card>
    <Card className="mb-7"><Text className="mb-3 font-medium text-ink dark:text-paper">Appearance</Text><View className="flex-row">{(["system", "light", "dark"] as ThemePreference[]).map((value) => <Chip key={value} label={value} selected={theme === value} onPress={() => setTheme(value)} />)}</View></Card>
    {validationError || save.error ? <Text className="mb-3 font-sans text-clay">{validationError ?? save.error?.message}</Text> : null}
    <Button label="Save preferences" loading={save.isPending} onPress={() => { if (!location) { setValidationError("Choose a location or use your current location."); return; } save.mutate(); }} />
    <Button label="Sign out" variant="secondary" className="mt-3" onPress={async () => { await signOut(); router.replace("/"); }} />
  </Screen>;
}
