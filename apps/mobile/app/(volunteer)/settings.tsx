import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LocationPicker } from "@/components/LocationPicker";
import { api } from "@/lib/api";
import type { LocationPoint, ThemePreference } from "@/lib/types";
import { useAuth } from "@/providers/AuthProvider";
import { Body, Button, Card, Chip, Display, Eyebrow, IconButton, Screen } from "@/components/ui";

const RADIUS_OPTIONS = [5, 10, 25, 50, 100];
const THEME_OPTIONS: ThemePreference[] = ["system", "light", "dark"];

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
    onSuccess: async () => {
      await refreshProfile();
      await client.invalidateQueries();
      router.back();
    },
  });

  return (
    <Screen className="px-5 pt-3">
      <IconButton icon="close" label="Close preferences" className="mb-6" onPress={() => router.back()} />
      <Eyebrow>Volunteer preferences</Eyebrow>
      <Display className="text-[30px] leading-8">Find something worth showing up for.</Display>
      <Body className="mb-7 mt-3">Choose where to search and how far you are willing to travel. Your live location is never tracked in the background.</Body>

      <LocationPicker value={location} onChange={(next) => { setLocation(next); setValidationError(null); }} token={token} />

      <Card className="mb-5">
        <Text className="mb-3 font-strong text-sm text-foreground dark:text-dark-foreground">Travel radius</Text>
        <View className="flex-row flex-wrap gap-y-2">
          {RADIUS_OPTIONS.map((value) => <Chip key={value} label={`${value} km`} selected={radius === value} onPress={() => setRadius(value)} />)}
        </View>
      </Card>

      <Card className="mb-5">
        <Text className="mb-3 font-strong text-sm text-foreground dark:text-dark-foreground">Appearance</Text>
        <View className="flex-row">
          {THEME_OPTIONS.map((value) => <Chip key={value} label={value} selected={theme === value} onPress={() => setTheme(value)} />)}
        </View>
      </Card>

      <Card className="mb-7">
        <Text className="mb-1 font-strong text-sm text-foreground dark:text-dark-foreground">Account</Text>
        <Body>{profile?.display_name}</Body>
        <Body>{profile?.email}</Body>
      </Card>

      {validationError || save.error ? <Text accessibilityRole="alert" className="mb-3 font-sans text-sm text-destructive dark:text-dark-destructive">{validationError ?? save.error?.message}</Text> : null}
      <Button label="Save preferences" loading={save.isPending} onPress={() => { if (!location) { setValidationError("Choose a location or use your current location."); return; } save.mutate(); }} />
      <Button label="Sign out" variant="secondary" className="mt-3" onPress={async () => { await signOut(); router.replace("/welcome"); }} />
    </Screen>
  );
}
