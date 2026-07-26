import { Tabs } from "expo-router";
import { tabIcon, useTabScreenOptions } from "@/components/tabs";

export default function VolunteerLayout() {
  const screenOptions = useTabScreenOptions();
  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: tabIcon("home-outline") }} />
      <Tabs.Screen name="discover" options={{ title: "Discover", tabBarIcon: tabIcon("compass-outline") }} />
      <Tabs.Screen name="activities" options={{ title: "Activities", tabBarIcon: tabIcon("calendar-outline") }} />
      <Tabs.Screen name="impact" options={{ title: "Impact", tabBarIcon: tabIcon("ribbon-outline") }} />
      <Tabs.Screen name="saved" options={{ title: "Saved", tabBarIcon: tabIcon("bookmark-outline") }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="search" options={{ href: null }} />
      <Tabs.Screen name="opportunity/[id]" options={{ href: null }} />
      <Tabs.Screen name="apply/[id]" options={{ href: null }} />
    </Tabs>
  );
}
