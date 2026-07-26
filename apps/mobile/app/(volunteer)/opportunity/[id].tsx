import { useEffect, useRef } from "react";
import { Image, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { Body, Button, Card, EmptyState, ErrorState, Eyebrow, Heading, IconButton, LoadingState, Screen, useThemeColours } from "@/components/ui";
import { formatEventDate } from "@/lib/format";
import { opportunityImage } from "@/lib/localAssets";
import { shareOpportunity } from "@/lib/share";

function DetailRow({ icon, title, value }: { icon: keyof typeof Ionicons.glyphMap; title: string; value: string }) {
  const colours = useThemeColours();
  return (
    <View className="mb-5 flex-row gap-4">
      <View className="h-11 w-11 items-center justify-center rounded-full bg-secondary dark:bg-dark-secondary"><Ionicons name={icon} size={20} color={colours.primary} /></View>
      <View className="flex-1"><Text className="font-strong text-sm text-foreground dark:text-dark-foreground">{title}</Text><Body className="mt-1">{value}</Body></View>
    </View>
  );
}

export default function OpportunityDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const client = useQueryClient();
  const viewRecorded = useRef(false);
  const query = useQuery({ queryKey: ["opportunity", id], queryFn: () => api.opportunity(id, token) });
  const save = useMutation({
    mutationFn: (value: boolean) => api.setSaved(id, value, token),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["opportunity", id] });
      client.invalidateQueries({ queryKey: ["opportunities"] });
    },
  });

  useEffect(() => {
    if (!id || viewRecorded.current) return;
    viewRecorded.current = true;
    void api.trackOpportunityEvent(id, "viewed", token);
  }, [id, token]);

  if (query.isLoading) return <Screen scroll={false}><LoadingState /></Screen>;
  if (query.isError) return <Screen><ErrorState error={query.error} onRetry={() => query.refetch()} /></Screen>;
  const item = query.data;
  if (!item) return <Screen><EmptyState title="Opportunity unavailable" body="It may have been unpublished by the host." /></Screen>;
  const image = opportunityImage(item.id, item.image_url);
  const placesLeft = Math.max(item.capacity - item.confirmed_count, 0);

  return (
    <Screen className="px-0 pt-0">
      <View className="relative">
        {image ? <Image source={image} className="h-72 w-full" resizeMode="cover" /> : <View className="h-72 bg-secondary dark:bg-dark-secondary" />}
        <IconButton icon="arrow-back" label="Back" tone="overlay" className="absolute left-5 top-5" onPress={() => router.back()} />
        <IconButton
          icon={item.is_saved ? "bookmark" : "bookmark-outline"}
          label={item.is_saved ? "Remove from saved" : "Save opportunity"}
          tone="overlay"
          className="absolute right-[72px] top-5"
          onPress={() => save.mutate(!item.is_saved)}
        />
        <IconButton
          icon="share-social-outline"
          label="Share opportunity"
          tone="overlay"
          className="absolute right-5 top-5"
          onPress={() => { void shareOpportunity(item, token); }}
        />
      </View>
      <View className="px-5 pb-10 pt-6">
        <Eyebrow>{item.organisation_name}</Eyebrow>
        <Heading className="text-[34px] leading-10">{item.title}</Heading>
        <Body className="mt-3">{item.description}</Body>
        <Card className="my-6 border-0 bg-secondary dark:bg-dark-secondary"><Eyebrow>Your impact</Eyebrow><Text className="font-display text-xl leading-7 text-foreground dark:text-dark-foreground">{item.impact_statement}</Text></Card>
        <DetailRow icon="calendar-outline" title="When" value={`${formatEventDate(item.starts_at)} · ${item.recurrence.replace("_", " ")}`} />
        <DetailRow icon="location-outline" title="Meeting point" value={`${item.meeting_point}, ${item.location_label}`} />
        <DetailRow icon="walk-outline" title="What you’ll do" value={item.tasks} />
        <DetailRow icon="people-outline" title="Places" value={`${item.confirmed_count} of ${item.capacity} confirmed · minimum age ${item.minimum_age}`} />
        <DetailRow icon="accessibility-outline" title="Access" value={item.accessibility} />
        <DetailRow icon="shield-checkmark-outline" title="Safety and what to bring" value={item.safety_notes} />
        <Button
          label={placesLeft ? "Apply to help" : "Join the waitlist"}
          onPress={() => router.push(`/(volunteer)/apply/${item.id}`)}
        />
        <Button
          label="Share with a friend"
          variant="secondary"
          className="mt-3"
          onPress={() => { void shareOpportunity(item, token); }}
        />
      </View>
    </Screen>
  );
}
