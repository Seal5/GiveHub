import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme, type ColorValue } from "react-native";

const icon = (name: keyof typeof Ionicons.glyphMap) => ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) => <Ionicons name={focused ? name.replace("-outline", "") as keyof typeof Ionicons.glyphMap : name} color={color} size={Math.min(size, 21)} />;
export default function OrganiserLayout() {
  const dark = useColorScheme() === "dark";
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: dark ? "#8BD19F" : "#2A8D58", tabBarInactiveTintColor: dark ? "#9BAC9F" : "#657166", tabBarStyle: { backgroundColor: dark ? "#101A14" : "#F6F6F0", borderTopColor: dark ? "#2B372F" : "#E8E8E2", height: 76, paddingBottom: 10, paddingTop: 8 }, tabBarLabelStyle: { fontFamily: "DMSans_700Bold", fontSize: 10 } }}>
    <Tabs.Screen name="index" options={{ title: "Overview", tabBarIcon: icon("home-outline") }} />
    <Tabs.Screen name="pipeline" options={{ title: "Pipeline", tabBarIcon: icon("people-outline") }} />
    <Tabs.Screen name="create" options={{ title: "Post", tabBarIcon: icon("add-circle-outline") }} />
    <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: icon("menu-outline") }} />
    <Tabs.Screen name="application/[id]" options={{ href: null }} />
    <Tabs.Screen name="opportunity/[id]" options={{ href: null }} />
  </Tabs>;
}
