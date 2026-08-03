import { Tabs } from "expo-router";
import { tabIcon, useTabScreenOptions } from "@/components/tabs";

export default function OrganiserLayout() {
  const screenOptions = useTabScreenOptions();
  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen name="index" options={{ title: "Overview", tabBarIcon: tabIcon("home-outline") }} />
      <Tabs.Screen name="pipeline" options={{ title: "Pipeline", tabBarIcon: tabIcon("people-outline") }} />
      <Tabs.Screen name="create" options={{ title: "Post", tabBarIcon: tabIcon("add-circle-outline") }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: tabIcon("menu-outline") }} />
      <Tabs.Screen name="waiver" options={{ href: null }} />
      <Tabs.Screen name="application/[id]" options={{ href: null }} />
      <Tabs.Screen name="attendance/[id]" options={{ href: null }} />
      <Tabs.Screen name="source-review" options={{ href: null }} />
      <Tabs.Screen name="listing-reports" options={{ href: null }} />
      <Tabs.Screen name="source-health" options={{ href: null }} />
    </Tabs>
  );
}
