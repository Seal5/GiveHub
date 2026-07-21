import "../global.css";
import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts as useDMSans, DMSans_400Regular, DMSans_600SemiBold, DMSans_700Bold } from "@expo-google-fonts/dm-sans";
import { useFonts as useDisplay, LibreBaskerville_700Bold } from "@expo-google-fonts/libre-baskerville";
import { useFonts as useMono, DMMono_500Medium } from "@expo-google-fonts/dm-mono";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { LoadingState } from "@/components/ui";
import { useColorScheme as useNativeWindColourScheme } from "nativewind";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });

function NavigationGuard() {
  const { profile, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    const group = segments[0];
    if (!profile && (group === "(volunteer)" || group === "(organiser)")) router.replace("/");
    if (profile?.role === "volunteer" && group !== "(volunteer)") router.replace("/(volunteer)");
    if (profile?.role === "organiser" && group !== "(organiser)") router.replace("/(organiser)");
  }, [loading, profile, router, segments]);
  return null;
}

function ThemeSync() {
  const { profile } = useAuth();
  const { setColorScheme } = useNativeWindColourScheme();
  useEffect(() => setColorScheme(profile?.theme ?? "system"), [profile?.theme, setColorScheme]);
  return null;
}

function ThemedStatusBar() {
  const { colorScheme } = useNativeWindColourScheme();
  return <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />;
}

export default function RootLayout() {
  const [dm] = useDMSans({ DMSans_400Regular, DMSans_600SemiBold, DMSans_700Bold });
  const [display] = useDisplay({ LibreBaskerville_700Bold });
  const [mono] = useMono({ DMMono_500Medium });
  if (!dm || !display || !mono) return <LoadingState />;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NavigationGuard />
          <ThemeSync />
          <ThemedStatusBar />
          <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
