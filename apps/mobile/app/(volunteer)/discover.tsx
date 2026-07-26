import { FlatList, ImageBackground, Pressable, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { EmptyState, ErrorState, LoadingState, Screen } from "@/components/ui";
import { TAB_BAR_HEIGHT } from "@/components/tabs";
import { formatEventDate } from "@/lib/format";
import { opportunityImage } from "@/lib/localAssets";
import { shareOpportunity } from "@/lib/share";

export default function DiscoverScreen() {
  const { token } = useAuth();
  const client = useQueryClient();
  // Measured per render so rotation and the home indicator do not desync paging.
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cardHeight = windowHeight - TAB_BAR_HEIGHT - insets.top;
  const query = useQuery({ queryKey: ["opportunities", "discover"], queryFn: () => api.opportunities({}, token) });
  const save = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) => api.setSaved(id, value, token),
    onSuccess: () => client.invalidateQueries({ queryKey: ["opportunities"] }),
  });

  if (query.isLoading) return <Screen scroll={false}><LoadingState /></Screen>;
  if (query.isError) return <Screen><ErrorState error={query.error} onRetry={() => query.refetch()} /></Screen>;
  if (!query.data?.length) {
    return <Screen><EmptyState title="Nothing to discover yet" body="Widen your travel radius in preferences to see more of Wellington." /></Screen>;
  }

  return (
    <FlatList
      className="bg-dark-background"
      pagingEnabled
      snapToInterval={cardHeight}
      decelerationRate="fast"
      showsVerticalScrollIndicator={false}
      data={query.data}
      keyExtractor={(item) => item.id}
      refreshing={query.isRefetching}
      onRefresh={() => query.refetch()}
      renderItem={({ item }) => (
        <ImageBackground source={opportunityImage(item.id, item.image_url)} style={{ height: cardHeight }} resizeMode="cover">
          <LinearGradient colors={["transparent", "rgba(10,24,16,.97)"]} className="absolute inset-0" />
          <View className="flex-1 justify-end px-5 pb-8">
            <View className="mb-4 flex-row gap-2">
              <View className="rounded-full bg-background/90 px-3 py-1.5"><Text className="font-strong text-[10px] uppercase text-foreground">{item.distance_km === null ? "Distance unavailable" : `${item.distance_km.toFixed(1)} km away`}</Text></View>
              <View className="rounded-full bg-primary px-3 py-1.5"><Text className="font-strong text-[10px] uppercase text-primary-foreground">{item.effort}</Text></View>
            </View>
            <Text accessibilityRole="header" className="font-display text-[38px] leading-[42px] tracking-[-1.3px] text-white">{item.title}</Text>
            <Text className="mt-3 font-sans text-sm leading-5 text-white/75">{item.impact_statement}</Text>
            <Text className="mt-4 font-strong text-sm text-white">{formatEventDate(item.starts_at)} · {item.location_label}</Text>
            <View className="mt-6 flex-row gap-3">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.is_saved ? `Remove ${item.title} from saved` : `Save ${item.title}`}
                onPress={() => save.mutate({ id: item.id, value: !item.is_saved })}
                className="h-14 w-14 items-center justify-center rounded-card border border-white/30 active:opacity-70"
              >
                <Ionicons name={item.is_saved ? "bookmark" : "bookmark-outline"} size={23} color="#F8FFF8" />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Share ${item.title} with a friend`}
                onPress={() => { void shareOpportunity(item, token); }}
                className="h-14 w-14 items-center justify-center rounded-card border border-white/30 active:opacity-70"
              >
                <Ionicons name="share-social-outline" size={23} color="#F8FFF8" />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Explore ${item.title}`}
                onPress={() => router.push(`/(volunteer)/opportunity/${item.id}`)}
                className="min-h-14 flex-1 items-center justify-center rounded-card bg-primary active:opacity-80"
              >
                <Text className="font-strong text-sm text-primary-foreground">Explore this event</Text>
              </Pressable>
            </View>
          </View>
        </ImageBackground>
      )}
    />
  );
}
