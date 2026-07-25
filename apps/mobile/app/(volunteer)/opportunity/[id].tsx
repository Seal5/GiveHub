import { Image, Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { Body, Button, Card, EmptyState, Eyebrow, Heading, LoadingState, Screen } from "@/components/ui";
import { formatEventDate } from "@/lib/format";

function DetailRow({ icon, title, value }: { icon: keyof typeof Ionicons.glyphMap; title: string; value: string }) {
  return <View className="mb-5 flex-row gap-4"><View className="h-11 w-11 items-center justify-center rounded-full bg-fern/50"><Ionicons name={icon} size={20} color="#2D945D" /></View><View className="flex-1"><Text className="font-medium text-ink dark:text-paper">{title}</Text><Body className="mt-1">{value}</Body></View></View>;
}
export default function OpportunityDetail() {
  const { id } = useLocalSearchParams<{ id: string }>(); const { token } = useAuth(); const client = useQueryClient();
  const query = useQuery({ queryKey: ["opportunity", id], queryFn: () => api.opportunity(id, token) });
  const save = useMutation({ mutationFn: (value: boolean) => api.setSaved(id, value, token), onSuccess: () => { client.invalidateQueries({ queryKey: ["opportunity", id] }); client.invalidateQueries({ queryKey: ["opportunities"] }); } });
  if (query.isLoading) return <Screen scroll={false}><LoadingState /></Screen>;
  const item = query.data; if (!item) return <Screen><EmptyState title="Opportunity unavailable" body="It may have been unpublished by the host." /></Screen>;
  return <Screen className="px-0"><View className="relative">{item.image_url ? <Image source={{ uri: item.image_url }} className="h-72 w-full" resizeMode="cover" /> : null}<Pressable accessibilityLabel="Back" onPress={() => router.back()} className="absolute left-5 top-5 h-12 w-12 items-center justify-center rounded-full bg-paper/95"><Ionicons name="arrow-back" size={22} color="#102018" /></Pressable><Pressable accessibilityLabel="Save opportunity" onPress={() => save.mutate(!item.is_saved)} className="absolute right-5 top-5 h-12 w-12 items-center justify-center rounded-full bg-paper/95"><Ionicons name={item.is_saved ? "bookmark" : "bookmark-outline"} size={22} color="#2D945D" /></Pressable></View>
    <View className="px-5 pb-10 pt-6"><Eyebrow>{item.organisation_name}</Eyebrow><Heading className="text-[34px] leading-10">{item.title}</Heading><Body className="mt-3">{item.description}</Body><Card className="my-6 border-0 bg-fern/40"><Eyebrow>Your impact</Eyebrow><Text className="font-display text-xl leading-7 text-ink">{item.impact_statement}</Text></Card>
      <DetailRow icon="calendar-outline" title="When" value={`${formatEventDate(item.starts_at)} · ${item.recurrence.replace("_", " ")}`} /><DetailRow icon="location-outline" title="Meeting point" value={`${item.meeting_point}, ${item.suburb.name}`} /><DetailRow icon="walk-outline" title="What you’ll do" value={item.tasks} /><DetailRow icon="people-outline" title="Places" value={`${item.confirmed_count} of ${item.capacity} confirmed · minimum age ${item.minimum_age}`} /><DetailRow icon="accessibility-outline" title="Access" value={item.accessibility} /><DetailRow icon="shield-checkmark-outline" title="Safety and what to bring" value={item.safety_notes} />
      <Button label="Apply to help" onPress={() => router.push(`/(volunteer)/apply/${item.id}`)} />
    </View></Screen>;
}

