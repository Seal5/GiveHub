import { Ionicons } from "@expo/vector-icons";
import type { ColorValue } from "react-native";
import { useThemeColours } from "@/components/ui";

/** Height of the tab bar, shared with screens that size content against it. */
export const TAB_BAR_HEIGHT = 76;

export const tabIcon = (name: keyof typeof Ionicons.glyphMap) =>
  function TabIcon({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
    const glyph = focused ? (name.replace("-outline", "") as keyof typeof Ionicons.glyphMap) : name;
    return <Ionicons name={glyph} color={color} size={Math.min(size, 21)} />;
  };

/**
 * Reads the NativeWind scheme rather than the OS one so the tab bar follows the
 * user's saved light/dark preference instead of the device setting.
 */
export function useTabScreenOptions() {
  const colours = useThemeColours();
  return {
    headerShown: false as const,
    tabBarActiveTintColor: colours.primary,
    tabBarInactiveTintColor: colours.mutedForeground,
    tabBarStyle: {
      backgroundColor: colours.background,
      borderTopColor: colours.border,
      height: TAB_BAR_HEIGHT,
      paddingBottom: 10,
      paddingTop: 8,
    },
    tabBarLabelStyle: { fontFamily: "DMSans_700Bold", fontSize: 10 },
  };
}
