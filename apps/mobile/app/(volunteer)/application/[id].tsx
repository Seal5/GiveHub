import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import {
  Body,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Eyebrow,
  Field,
  Heading,
  LoadingState,
  Screen,
} from "@/components/ui";
import { statusLabel } from "@/lib/format";

export default function VolunteerApplicationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["application", id],
    queryFn: () => api.application(id, token),
  });
  const [note, setNote] = useState("");
  const [experience, setExperience] = useState("");
  const [availability, setAvailability] = useState("");
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);

  useEffect(() => {
    if (!query.data) return;
    setNote(query.data.note);
    setExperience(query.data.experience);
    setAvailability(query.data.availability);
  }, [query.data]);

  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["application", id] });
    void client.invalidateQueries({ queryKey: ["applications"] });
  };
  const save = useMutation({
    mutationFn: () => api.updateApplication(id, {
      note,
      experience,
      availability,
      version: query.data!.version,
    }, token),
    onSuccess: refresh,
  });
  const withdraw = useMutation({
    mutationFn: () => api.withdrawApplication(id, query.data!.version, token),
    onSuccess: () => {
      setConfirmWithdraw(false);
      refresh();
    },
  });

  if (query.isLoading) return <Screen><LoadingState /></Screen>;
  if (query.isError) return <Screen><ErrorState error={query.error} onRetry={() => query.refetch()} /></Screen>;
  const item = query.data;
  if (!item) return <Screen><EmptyState title="Application unavailable" body="This application could not be found." /></Screen>;
  const editable = !["confirmed", "declined", "withdrawn"].includes(item.status);

  return (
    <Screen>
      <Eyebrow>Your application</Eyebrow>
      <Heading>{item.opportunity_title}</Heading>
      <Card className="my-5 border-0 bg-secondary dark:bg-dark-secondary">
        <Text className="font-strong text-base text-foreground dark:text-dark-foreground">{statusLabel[item.status]}</Text>
        <Body className="mt-1">{item.next_step}</Body>
      </Card>
      <Body className="mb-5">
        These answers are stored by GiveHub and shared with the host organisation. You control them while the application is under review.
      </Body>
      <Field
        label="Personal note"
        value={note}
        onChangeText={setNote}
        multiline
        numberOfLines={5}
        textAlignVertical="top"
        editable={editable}
      />
      <Field
        label="Relevant experience"
        value={experience}
        onChangeText={setExperience}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        editable={editable}
      />
      <Field
        label="Availability"
        value={availability}
        onChangeText={setAvailability}
        editable={editable}
      />
      {save.error || withdraw.error ? (
        <Text accessibilityRole="alert" className="mb-4 font-sans text-sm text-destructive dark:text-dark-destructive">
          {(save.error ?? withdraw.error)?.message}
        </Text>
      ) : null}
      {editable ? (
        <>
          <Button label="Save changes" loading={save.isPending} onPress={() => save.mutate()} />
          {!confirmWithdraw ? (
            <Button label="Withdraw application" variant="secondary" className="mt-3" onPress={() => setConfirmWithdraw(true)} />
          ) : (
            <View className="mt-3 rounded-card border border-destructive p-4">
              <Text className="font-strong text-base text-foreground dark:text-dark-foreground">Withdraw this application?</Text>
              <Body className="mb-3 mt-1">The host will see that you withdrew. This cannot be undone.</Body>
              <Button label="Yes, withdraw" loading={withdraw.isPending} onPress={() => withdraw.mutate()} />
              <Button label="Keep application" variant="secondary" className="mt-2" onPress={() => setConfirmWithdraw(false)} />
            </View>
          )}
        </>
      ) : null}
      <Button label="View opportunity" variant="secondary" className="mt-3" onPress={() => router.push(`/(volunteer)/opportunity/${item.opportunity_id}`)} />
    </Screen>
  );
}
