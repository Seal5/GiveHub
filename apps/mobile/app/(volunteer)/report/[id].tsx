import { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Body, Button, Chip, Display, ErrorState, Eyebrow, Field, LoadingState, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import type { ListingReportReason } from "@/lib/types";
import { useAuth } from "@/providers/AuthProvider";

const reasons: { value: ListingReportReason; label: string }[] = [
  { value: "outdated", label: "Outdated information" },
  { value: "cancelled", label: "Event cancelled" },
  { value: "broken_link", label: "Broken application link" },
  { value: "safety_accessibility", label: "Safety or access concern" },
  { value: "duplicate", label: "Duplicate listing" },
  { value: "spam", label: "Spam or inappropriate" },
  { value: "other", label: "Something else" },
];

export default function ReportOpportunityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const [reason, setReason] = useState<ListingReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [complete, setComplete] = useState(false);
  const opportunity = useQuery({ queryKey: ["opportunity", id], queryFn: () => api.opportunity(id, token) });
  const submit = useMutation({
    mutationFn: () => api.reportOpportunity(id, { reason: reason!, details }, token),
    onSuccess: () => setComplete(true),
  });

  if (opportunity.isLoading) return <Screen scroll={false}><LoadingState /></Screen>;
  if (opportunity.isError) return <Screen><ErrorState error={opportunity.error} onRetry={() => opportunity.refetch()} /></Screen>;
  if (complete) return <Screen><Eyebrow>Report received</Eyebrow><Display>Thank you for helping keep GiveHub trustworthy.</Display><Body className="mb-7 mt-4">A reviewer will check the listing. Your report is private and does not automatically remove the opportunity.</Body><Button label="Back to opportunity" onPress={() => router.back()} /></Screen>;

  return (
    <Screen>
      <Eyebrow>Report listing</Eyebrow>
      <Display>What looks wrong?</Display>
      <Body className="mb-6 mt-3">Report {opportunity.data?.title}. Reports are private and reviewed before action is taken.</Body>
      <View className="mb-5 flex-row flex-wrap gap-y-2">
        {reasons.map((item) => <Chip key={item.value} label={item.label} selected={reason === item.value} onPress={() => setReason(item.value)} />)}
      </View>
      <Field label="Helpful details (optional)" placeholder="Tell the reviewer what you noticed" multiline numberOfLines={5} textAlignVertical="top" value={details} onChangeText={setDetails} />
      {submit.error ? <Text accessibilityRole="alert" className="mb-3 font-sans text-sm text-destructive dark:text-dark-destructive">{submit.error.message}</Text> : null}
      <Button label="Send private report" disabled={!reason} loading={submit.isPending} onPress={() => submit.mutate()} />
      <Button className="mt-3" variant="secondary" label="Cancel" onPress={() => router.back()} />
    </Screen>
  );
}
