import { useEffect, useRef } from "react";
import { Image, Linking, Text, View } from "react-native";
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
  const sourceDate = item.source_updated_at ?? item.updated_at;
  const duration = item.time_commitment_minutes >= 60
    ? `${Math.round(item.time_commitment_minutes / 60 * 10) / 10} hours`
    : `${item.time_commitment_minutes} minutes`;
  const openApplication = () => {
    if (item.application_mode === "external" && item.external_application_url) {
      void Linking.openURL(item.external_application_url);
      return;
    }
    router.push(`/(volunteer)/apply/${item.id}`);
  };

  return (
    <Screen className="px-0 pt-0">
      <View className="relative">
        {image ? (
          <Image source={image} className="w-full" style={{ height: 300, flexShrink: 0 }} resizeMode="cover" />
        ) : (
          <View className="bg-secondary dark:bg-dark-secondary" style={{ height: 300 }} />
        )}
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
        <DetailRow icon="time-outline" title="Time commitment" value={duration} />
        <DetailRow icon="location-outline" title="Meeting point" value={`${item.meeting_point}, ${item.location_label}`} />
        <DetailRow icon="walk-outline" title="What you’ll do" value={item.tasks} />
        <DetailRow icon="people-outline" title="Eligibility and places" value={`${item.confirmed_count} of ${item.capacity} confirmed · minimum age ${item.minimum_age}. ${item.eligibility_notes}`} />
        <DetailRow icon="accessibility-outline" title="Access" value={item.accessibility} />
        <DetailRow icon="school-outline" title="Training commitment" value={item.training_commitment} />
        <DetailRow icon="checkmark-done-outline" title="Screening steps" value={item.screening_steps} />
        <DetailRow icon="bus-outline" title="Getting there" value={item.transportation_info} />
        <DetailRow icon="ribbon-outline" title="Qualifications" value={item.qualifications} />
        <DetailRow icon="shield-checkmark-outline" title="Safety and what to bring" value={item.safety_notes} />
        <Card className="mb-6">
          <Eyebrow>Application and listing source</Eyebrow>
          <Text className="font-strong text-base text-foreground dark:text-dark-foreground">
            {item.application_mode === "external"
              ? `Apply on ${item.organisation_name}’s website`
              : "Apply securely through GiveHub"}
          </Text>
          <Body className="mt-2">
            {item.application_mode === "external"
              ? "You’ll leave GiveHub to apply. GiveHub will not receive or store your form answers."
              : `Your application is stored by GiveHub and shared with ${item.organisation_name}.`}
          </Body>
          <Body className="mt-3 text-sm">
            Source: {item.listing_source} · {item.listing_verification_status} · updated {new Date(sourceDate).toLocaleDateString("en-NZ")}
          </Body>
        </Card>
        <Button
          label={item.application_mode === "external"
            ? `Continue to ${item.organisation_name}`
            : placesLeft ? "Apply to help" : "Join the waitlist"}
          onPress={openApplication}
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
