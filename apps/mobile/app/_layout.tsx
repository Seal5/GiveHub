import "../global.css";
import { useEffect } from "react";
import { Platform, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts as useDMSans, DMSans_400Regular, DMSans_600SemiBold, DMSans_700Bold } from "@expo-google-fonts/dm-sans";
import { useFonts as useDisplay, LibreBaskerville_700Bold } from "@expo-google-fonts/libre-baskerville";
import { useFonts as useMono, DMMono_500Medium } from "@expo-google-fonts/dm-mono";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { LoadingState } from "@/components/ui";
import { takePendingRoute } from "@/lib/pendingRoute";
import { useColorScheme as useNativeWindColourScheme } from "nativewind";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });

function NavigationGuard() {
  const { profile, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    const group = segments[0];
    // The share route resolves its own destination once auth state settles.
    if (group === "o") return;
    if (!profile) {
      if (group === "(volunteer)" || group === "(organiser)") router.replace("/welcome");
      return;
    }
    const pending = takePendingRoute();
    if (pending && profile.role === "volunteer") {
      router.replace(pending as Parameters<typeof router.replace>[0]);
      return;
    }
    if (profile.role === "volunteer" && group !== "(volunteer)") router.replace("/(volunteer)");
    if (profile.role === "organiser" && group !== "(organiser)") router.replace("/(organiser)");
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

function AppFrame() {
  return (
    <View
      className="flex-1 overflow-hidden bg-background dark:bg-dark-background"
      style={Platform.OS === "web" ? { width: "100%", maxWidth: 480, alignSelf: "center" } : undefined}
    >
      <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />
    </View>
  );
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
          <AppFrame />
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
