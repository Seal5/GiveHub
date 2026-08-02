import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { LocationPoint } from "@/lib/types";
import { Body, Button, Card, useThemeColours } from "@/components/ui";

type Props = {
  value: LocationPoint | null;
  onChange: (value: LocationPoint) => void;
  token?: string | null;
  title?: string;
};

export function LocationPicker({ value, onChange, token, title = "Search location" }: Props) {
  const [query, setQuery] = useState(value?.label ?? "");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const colours = useThemeColours();
  useEffect(() => {
    const timeout = setTimeout(() => setSearchQuery(query.trim()), 450);
    return () => clearTimeout(timeout);
  }, [query]);
  const suggestions = useQuery({
    queryKey: ["location-suggestions", searchQuery],
    queryFn: () => api.locationSuggestions(searchQuery, token),
    enabled: searchQuery.length >= 3 && searchQuery !== value?.label,
    staleTime: 60_000,
  });
  const showSuggestions = searchQuery.length >= 3 && searchQuery !== value?.label;

  const useTypedLocation = () => {
    const label = query.trim();
    if (label.length < 3) {
      setLocationError("Enter the full address, town, postcode, or landmark.");
      return;
    }
    const parts = label.split(",").map((part) => part.trim()).filter(Boolean);
    const postcode = label.match(/\b[A-Z]\d[A-Z][ -]?\d[A-Z]\d\b/i)?.[0]?.toUpperCase() ?? null;
    const provinceIndex = parts.findIndex((part) => /^(ON|Ontario)(?:\s+[A-Z]\d[A-Z][ -]?\d[A-Z]\d)?$/i.test(part));
    const city = (provinceIndex > 0 ? parts[provinceIndex - 1] : parts.at(-1))?.trim() || "Toronto";
    const selected: LocationPoint = {
      label,
      address_line: parts[0] ?? label,
      locality: parts.length > 1 ? parts.at(-2)! : city,
      city,
      postcode,
      country_code: "CA",
      // Manual entries use downtown Toronto for approximate GTA radius previews.
      latitude: 43.6532,
      longitude: -79.3832,
    };
    setLocationError(null);
    onChange(selected);
  };

  const selectSuggestion = async (placeId: string) => {
    setLocationError(null);
    try {
      const selected = await api.resolveLocation(placeId, token);
      setQuery(selected.label);
      onChange(selected);
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : "Could not select that location.");
    }
  };

  const useCurrentLocation = async () => {
    setLocating(true); setLocationError(null);
    try {
      const Location = await import("expo-location");
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error("Location permission was declined. Enter a place instead.");
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [address] = await Location.reverseGeocodeAsync(position.coords);
      const locality = address?.district ?? address?.subregion ?? "Current area";
      const city = address?.city ?? address?.region ?? "";
      const street = [address?.streetNumber, address?.street ?? address?.name].filter(Boolean).join(" ");
      const label = [street || locality, city].filter(Boolean).join(", ");
      const selected: LocationPoint = {
        label: label || "Current location",
        address_line: street || locality,
        locality,
        city,
        postcode: address?.postalCode ?? null,
        country_code: address?.isoCountryCode ?? "CA",
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      setQuery(selected.label); onChange(selected);
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : "Could not get your location.");
    } finally { setLocating(false); }
  };

  return <Card className="mb-5">
    <Text className="mb-3 font-strong text-sm text-foreground dark:text-dark-foreground">{title}</Text>
    <View className="min-h-14 flex-row items-center rounded-card border border-border bg-background px-4 dark:border-dark-border dark:bg-dark-background">
      <Ionicons name="location-outline" size={20} color={colours.primary} />
      <TextInput accessibilityLabel={title} value={query} onChangeText={(next) => { setQuery(next); setLocationError(null); }} placeholder="GTA address, city, postal code or landmark" placeholderTextColor={colours.mutedForeground} className="ml-3 flex-1 font-sans text-sm text-foreground dark:text-dark-foreground" />
    </View>
    {showSuggestions ? suggestions.data?.map((item) => <Pressable key={item.place_id} accessibilityRole="button" onPress={() => selectSuggestion(item.place_id)} className="min-h-12 justify-center border-b border-border py-2 dark:border-dark-border"><Text className="font-sans text-sm text-foreground dark:text-dark-foreground">{item.label}</Text></Pressable>) : null}
    {showSuggestions && suggestions.error ? <Text className="mt-2 font-sans text-sm text-destructive dark:text-dark-destructive">{suggestions.error.message}</Text> : null}
    {showSuggestions ? <View className="mt-3"><Button label="Use address as typed" variant="secondary" onPress={useTypedLocation} /><Text className="mt-2 font-sans text-xs text-muted-foreground dark:text-dark-muted-foreground">Free address search data © OpenStreetMap contributors.</Text></View> : null}
    {value ? <Body className="mt-3">Using {value.label}</Body> : null}
    {locationError ? <Text className="mt-2 font-sans text-sm text-destructive dark:text-dark-destructive">{locationError}</Text> : null}
    <Button label="Use my current location" variant="secondary" loading={locating} className="mt-4" onPress={useCurrentLocation} />
    <Text className="mt-2 font-sans text-xs text-muted-foreground dark:text-dark-muted-foreground">Used only while the app is open. GiveHub does not track background location.</Text>
  </Card>;
}
