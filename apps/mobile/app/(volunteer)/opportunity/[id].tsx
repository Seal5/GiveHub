import { useEffect, useRef, useState } from "react";
import { Image, Pressable, Share, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import {
  Body,
  Button,
  Card,
  Chip,
  EmptyState,
  Eyebrow,
  Field,
  Heading,
  LoadingState,
  Screen,
} from "@/components/ui";
import { formatEventDate } from "@/lib/format";
import { opportunityImage } from "@/lib/localAssets";
import type { ReportReason } from "@/lib/types";

function DetailRow({
  icon,
  title,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  value: string;
}) {
  return (
    <View className="mb-5 flex-row gap-4">
      <View className="h-11 w-11 items-center justify-center rounded-full bg-secondary dark:bg-dark-secondary">
        <Ionicons name={icon} size={20} color="#2A8D58" />
      </View>
      <View className="flex-1">
        <Text className="font-strong text-sm text-foreground dark:text-dark-foreground">
          {title}
        </Text>
        <Body className="mt-1">{value}</Body>
      </View>
    </View>
  );
}

export default function OpportunityDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const client = useQueryClient();
  const viewRecorded = useRef(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>("misleading");
  const [reportDetails, setReportDetails] = useState("");
  const query = useQuery({
    queryKey: ["opportunity", id],
    queryFn: () => api.opportunity(id, token),
  });
  const save = useMutation({
    mutationFn: (value: boolean) => api.setSaved(id, value, token),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["opportunity", id] });
      client.invalidateQueries({ queryKey: ["opportunities"] });
    },
  });
  const report = useMutation({
    mutationFn: () =>
      api.reportOpportunity(
        id,
        { reason: reportReason, details: reportDetails },
        token,
      ),
    onSuccess: () => setReportOpen(false),
  });
  useEffect(() => {
    if (!id || viewRecorded.current) return;
    viewRecorded.current = true;
    void api.trackOpportunityEvent(id, "viewed", token);
  }, [id, token]);
  if (query.isLoading)
    return (
      <Screen scroll={false}>
        <LoadingState />
      </Screen>
    );
  const item = query.data;
  if (!item)
    return (
      <Screen>
        <EmptyState
          title="Opportunity unavailable"
          body="It may have been unpublished by the host."
        />
      </Screen>
    );
  const image = opportunityImage(item.id, item.image_url);
  return (
    <Screen className="px-0 pt-0">
      <View className="relative">
        {image ? (
          <Image
            source={image}
            className="w-full"
            style={{ height: 210, flexShrink: 0 }}
            resizeMode="cover"
          />
        ) : (
          <View className="bg-secondary dark:bg-dark-secondary" style={{ height: 210 }} />
        )}
        <Pressable
          accessibilityLabel="Back"
          onPress={() => router.back()}
          className="absolute left-5 top-5 h-11 w-11 items-center justify-center rounded-full bg-background/95"
        >
          <Ionicons name="arrow-back" size={21} color="#17221A" />
        </Pressable>
        <Pressable
          accessibilityLabel="Save opportunity"
          onPress={() => save.mutate(!item.is_saved)}
          className="absolute right-[72px] top-5 h-11 w-11 items-center justify-center rounded-full bg-background/95"
        >
          <Ionicons
            name={item.is_saved ? "bookmark" : "bookmark-outline"}
            size={21}
            color="#2A8D58"
          />
        </Pressable>
        <Pressable
          accessibilityLabel="Share opportunity"
          onPress={async () => {
            await Share.share({
              title: item.title,
              message: `${item.title} with ${item.organisation_name}\n${item.location_label}\n\nOpen GiveHub to volunteer.`,
            });
            await api.trackOpportunityEvent(id, "shared", token);
          }}
          className="absolute right-5 top-5 h-11 w-11 items-center justify-center rounded-full bg-background/95"
        >
          <Ionicons name="share-social-outline" size={21} color="#2A8D58" />
        </Pressable>
      </View>
      <View className="px-5 pb-10 pt-6">
        <Eyebrow>{item.organisation_name}</Eyebrow>
        <Heading className="text-[34px] leading-10">{item.title}</Heading>
        <Body className="mt-3">{item.description}</Body>
        <Card className="my-6 border-0 bg-secondary dark:bg-dark-secondary">
          <Eyebrow>Your impact</Eyebrow>
          <Text className="font-display text-xl leading-7 text-foreground dark:text-dark-foreground">
            {item.impact_statement}
          </Text>
        </Card>
        <DetailRow
          icon="calendar-outline"
          title="When"
          value={`${formatEventDate(item.starts_at)} · ${item.recurrence.replace("_", " ")}`}
        />
        <DetailRow
          icon="location-outline"
          title="Meeting point"
          value={`${item.meeting_point}, ${item.location_label}`}
        />
        <DetailRow
          icon="walk-outline"
          title="What you’ll do"
          value={item.tasks}
        />
        <DetailRow
          icon="people-outline"
          title="Places"
          value={`${item.confirmed_count} of ${item.capacity} confirmed · minimum age ${item.minimum_age}`}
        />
        <DetailRow
          icon="accessibility-outline"
          title="Access"
          value={item.accessibility}
        />
        <DetailRow
          icon="shield-checkmark-outline"
          title="Safety and what to bring"
          value={item.safety_notes}
        />
        {item.status === "closed" ? (
          <Card className="border-0 bg-secondary dark:bg-dark-secondary">
            <Text className="font-strong text-sm text-foreground dark:text-dark-foreground">
              Applications are closed
            </Text>
            <Body className="mt-1">
              The host is no longer accepting applications for this opportunity.
            </Body>
          </Card>
        ) : (
          <Button
            label="Apply to help"
            onPress={() => router.push(`/(volunteer)/apply/${item.id}`)}
          />
        )}
        {report.isSuccess ? (
          <Card className="mt-4 border-0 bg-secondary dark:bg-dark-secondary">
            <Text className="font-strong text-sm text-primary dark:text-dark-primary">
              Report received
            </Text>
            <Body className="mt-1">
              The report is stored for moderation review.
            </Body>
          </Card>
        ) : (
          <>
            <Button
              className="mt-4"
              label={reportOpen ? "Cancel report" : "Report this opportunity"}
              variant="secondary"
              onPress={() => setReportOpen((value) => !value)}
            />
            {reportOpen ? (
              <Card className="mt-4">
                <Text className="font-display text-xl text-foreground dark:text-dark-foreground">
                  Why are you reporting this?
                </Text>
                <View className="mt-4 flex-row flex-wrap gap-y-2">
                  {(
                    [
                      "misleading",
                      "unsafe",
                      "inappropriate",
                      "scam",
                      "other",
                    ] as ReportReason[]
                  ).map((reason) => (
                    <Chip
                      key={reason}
                      label={reason}
                      selected={reportReason === reason}
                      onPress={() => setReportReason(reason)}
                    />
                  ))}
                </View>
                <View className="mt-4">
                  <Field
                    label="Additional details (optional)"
                    value={reportDetails}
                    onChangeText={setReportDetails}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    placeholder="Tell the moderation team what happened"
                  />
                </View>
                {report.error ? (
                  <Text className="mb-3 font-sans text-sm text-destructive dark:text-dark-destructive">
                    {report.error.message}
                  </Text>
                ) : null}
                <Button
                  label="Submit report"
                  loading={report.isPending}
                  onPress={() => report.mutate()}
                />
              </Card>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}
