import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme, type ColorValue } from "react-native";

const icon = (name: keyof typeof Ionicons.glyphMap) => ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color} size={size} />;
export default function OrganiserLayout() {
  const dark = useColorScheme() === "dark";
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: "#2D945D", tabBarInactiveTintColor: dark ? "#AAB5AC" : "#647269", tabBarStyle: { backgroundColor: dark ? "#0B1710" : "#F5F1E7", borderTopColor: dark ? "#27342C" : "#D9D8CF", height: 68, paddingBottom: 8 }, tabBarLabelStyle: { fontFamily: "DMSans_600SemiBold", fontSize: 11 } }}>
    <Tabs.Screen name="index" options={{ title: "Overview", tabBarIcon: icon("home-outline") }} />
    <Tabs.Screen name="pipeline" options={{ title: "Pipeline", tabBarIcon: icon("people-outline") }} />
    <Tabs.Screen name="create" options={{ title: "Post", tabBarIcon: icon("add-circle-outline") }} />
    <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: icon("menu-outline") }} />
    <Tabs.Screen name="application/[id]" options={{ href: null }} />
  </Tabs>;
}
