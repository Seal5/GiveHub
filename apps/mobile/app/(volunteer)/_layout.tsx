import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme, type ColorValue } from "react-native";

const icon = (name: keyof typeof Ionicons.glyphMap) => ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color} size={size} />;

export default function VolunteerLayout() {
  const dark = useColorScheme() === "dark";
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: "#2D945D", tabBarInactiveTintColor: dark ? "#AAB5AC" : "#647269", tabBarStyle: { backgroundColor: dark ? "#0B1710" : "#F5F1E7", borderTopColor: dark ? "#27342C" : "#D9D8CF", height: 68, paddingBottom: 8 }, tabBarLabelStyle: { fontFamily: "DMSans_600SemiBold", fontSize: 11 } }}>
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: icon("home-outline") }} />
      <Tabs.Screen name="discover" options={{ title: "Discover", tabBarIcon: icon("compass-outline") }} />
      <Tabs.Screen name="activities" options={{ title: "Activities", tabBarIcon: icon("calendar-outline") }} />
      <Tabs.Screen name="saved" options={{ title: "Saved", tabBarIcon: icon("bookmark-outline") }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="search" options={{ href: null }} />
      <Tabs.Screen name="opportunity/[id]" options={{ href: null }} />
      <Tabs.Screen name="apply/[id]" options={{ href: null }} />
    </Tabs>
  );
}
