import { useEffect, useState } from "react";
import { Text } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { Body, Button, Card, Display, Eyebrow, Field, IconButton, LoadingState, Screen } from "@/components/ui";

export default function WaiverEditor() {
  const { token } = useAuth();
  const client = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [seeded, setSeeded] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const waiver = useQuery({ queryKey: ["organiser", "waiver"], queryFn: () => api.organiserWaiver(token), retry: false });
  const publish = useMutation({
    mutationFn: () => api.publishWaiver({ title: title.trim(), body: body.trim() }, token),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["organiser", "waiver"] });
      router.back();
    },
  });

  // Seed the editor from whichever waiver currently applies, including the default.
  useEffect(() => {
    if (seeded || !waiver.data) return;
    setSeeded(true);
    setTitle(waiver.data.title);
    setBody(waiver.data.body);
  }, [seeded, waiver.data]);

  if (waiver.isLoading) return <Screen scroll={false}><LoadingState /></Screen>;

  return (
    <Screen>
      <IconButton icon="arrow-back" label="Back" className="mb-6" onPress={() => router.back()} />
      <Eyebrow>Volunteer agreement</Eyebrow>
      <Display className="text-[30px] leading-8">Set the terms people sign.</Display>
      <Body className="mb-6 mt-3">
        Volunteers accept this before applying to any of your opportunities. Publishing creates a new
        version; agreements already signed keep the wording they were signed against.
      </Body>

      {waiver.data ? (
        <Card className="mb-5 border-0 bg-secondary dark:bg-dark-secondary">
          <Text className="font-medium text-sm text-foreground dark:text-dark-foreground">Currently live</Text>
          <Body className="mt-1">{waiver.data.title} · version {waiver.data.version}</Body>
        </Card>
      ) : (
        <Card className="mb-5 border-0 bg-secondary dark:bg-dark-secondary">
          <Text className="font-medium text-sm text-foreground dark:text-dark-foreground">Using the GiveHub default</Text>
          <Body className="mt-1">Publish your own wording to replace it for your organisation.</Body>
        </Card>
      )}

      <Field label="Agreement title" placeholder="e.g. Coastal restoration volunteer agreement" value={title} onChangeText={(value) => { setTitle(value); setValidationError(null); }} />
      <Field
        label="Agreement text"
        placeholder="Set out participation, safety, risk, and consent terms."
        multiline
        numberOfLines={16}
        textAlignVertical="top"
        value={body}
        onChangeText={(value) => { setBody(value); setValidationError(null); }}
      />

      <Card className="mb-5 border-0 bg-secondary dark:bg-dark-secondary">
        <Text className="font-medium text-sm text-foreground dark:text-dark-foreground">Before you publish</Text>
        <Body className="mt-2">
          GiveHub does not provide legal advice. Have your own wording reviewed, and keep the parts
          covering under-18 consent and Ontario or Canadian law that cannot be excluded by agreement.
        </Body>
      </Card>

      {validationError || publish.error ? (
        <Text accessibilityRole="alert" className="mb-3 font-sans text-sm text-destructive dark:text-dark-destructive">
          {validationError ?? publish.error?.message}
        </Text>
      ) : null}
      <Button
        label="Publish new version"
        loading={publish.isPending}
        onPress={() => {
          if (title.trim().length < 4) { setValidationError("Give the agreement a clear title."); return; }
          if (body.trim().length < 40) { setValidationError("The agreement text is too short to publish."); return; }
          publish.mutate();
        }}
      />
    </Screen>
  );
}
