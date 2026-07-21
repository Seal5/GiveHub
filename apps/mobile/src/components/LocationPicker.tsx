import { useDeferredValue, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { LocationPoint } from "@/lib/types";
import { Body, Button, Card } from "@/components/ui";

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
  const deferredQuery = useDeferredValue(query.trim());
  const suggestions = useQuery({
    queryKey: ["location-suggestions", deferredQuery],
    queryFn: () => api.locationSuggestions(deferredQuery, token),
    enabled: deferredQuery.length >= 3 && deferredQuery !== value?.label,
    staleTime: 60_000,
  });
  const showSuggestions = deferredQuery.length >= 3 && deferredQuery !== value?.label;

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
        country_code: address?.isoCountryCode ?? "NZ",
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      setQuery(selected.label); onChange(selected);
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : "Could not get your location.");
    } finally { setLocating(false); }
  };

  return <Card className="mb-5">
    <Text className="mb-3 font-medium text-ink dark:text-paper">{title}</Text>
    <View className="min-h-14 flex-row items-center rounded-2xl border border-ink/10 bg-paper px-4 dark:border-paper/10 dark:bg-night">
      <Ionicons name="location-outline" size={20} color="#2D945D" />
      <TextInput accessibilityLabel={title} value={query} onChangeText={(next) => { setQuery(next); setLocationError(null); }} placeholder="Address, town, postcode or landmark" placeholderTextColor="#829087" className="ml-3 flex-1 font-sans text-base text-ink dark:text-paper" />
    </View>
    {showSuggestions ? suggestions.data?.map((item) => <Pressable key={item.place_id} accessibilityRole="button" onPress={() => selectSuggestion(item.place_id)} className="min-h-12 justify-center border-b border-ink/10 py-2 dark:border-paper/10"><Text className="font-sans text-sm text-ink dark:text-paper">{item.label}</Text></Pressable>) : null}
    {showSuggestions && suggestions.error ? <Text className="mt-2 font-sans text-sm text-clay">{suggestions.error.message}</Text> : null}
    {value ? <Body className="mt-3">Using {value.label}</Body> : null}
    {locationError ? <Text className="mt-2 font-sans text-sm text-clay">{locationError}</Text> : null}
    <Button label="Use my current location" variant="secondary" loading={locating} className="mt-4" onPress={useCurrentLocation} />
    <Text className="mt-2 font-sans text-xs text-ink/50 dark:text-paper/50">Used only while the app is open. GiveHub does not track background location.</Text>
  </Card>;
}
