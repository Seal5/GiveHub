import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import {
  Body,
  Button,
  Card,
  Display,
  Eyebrow,
  Field,
  LoadingState,
  Screen,
} from "@/components/ui";

const availabilityOptions = [
  {
    value: "Available for the full event",
    label: "Full event",
    detail: "I can attend from start to finish",
  },
  {
    value: "Available for part of the event",
    label: "Part of the event",
    detail: "I can help for part of the scheduled time",
  },
  {
    value: "Timing needs confirmation",
    label: "Need to confirm",
    detail: "I’m interested but need to check the timing",
  },
  {
    value: "Available for a future date",
    label: "Future date",
    detail: "I’d like to hear about another date",
  },
];

const schema = z.object({
  note: z.string().min(10, "Tell the host a little more"),
  experience: z.string(),
  availability: z
    .string()
    .refine(
      (value) => availabilityOptions.some((option) => option.value === value),
      "Choose your availability",
    ),
});
type Values = z.infer<typeof schema>;

function AvailabilitySelect({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = availabilityOptions.find((option) => option.value === value);
  return (
    <View className="mb-5">
      <Text className="mb-2 font-strong text-xs uppercase tracking-[1.3px] text-muted-foreground dark:text-dark-muted-foreground">
        Availability
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choose availability"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        className="min-h-14 flex-row items-center rounded-card border border-border bg-card px-4 dark:border-dark-border dark:bg-dark-card"
      >
        <View className="flex-1">
          <Text className="font-medium text-sm text-foreground dark:text-dark-foreground">
            {selected?.label ?? "Choose an option"}
          </Text>
          {selected ? (
            <Text className="mt-0.5 font-sans text-xs text-muted-foreground dark:text-dark-muted-foreground">
              {selected.detail}
            </Text>
          ) : null}
        </View>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={18}
          color="#657166"
        />
      </Pressable>
      {open ? (
        <View className="mt-2 overflow-hidden rounded-card border border-border bg-card dark:border-dark-border dark:bg-dark-card">
          {availabilityOptions.map((option, index) => {
            const active = option.value === value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`min-h-[64px] flex-row items-center px-4 active:bg-muted dark:active:bg-dark-muted ${index ? "border-t border-border dark:border-dark-border" : ""}`}
              >
                <View className="flex-1 pr-3">
                  <Text
                    className={`font-medium text-sm ${active ? "text-primary dark:text-dark-primary" : "text-foreground dark:text-dark-foreground"}`}
                  >
                    {option.label}
                  </Text>
                  <Text className="mt-0.5 font-sans text-xs text-muted-foreground dark:text-dark-muted-foreground">
                    {option.detail}
                  </Text>
                </View>
                {active ? (
                  <Ionicons name="checkmark-circle" size={19} color="#2A8D58" />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {error ? (
        <Text className="mt-1 font-sans text-sm text-destructive dark:text-dark-destructive">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export default function ApplyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const client = useQueryClient();
  const [complete, setComplete] = useState(false);
  const startRecorded = useRef(false);
  const event = useQuery({
    queryKey: ["opportunity", id],
    queryFn: () => api.opportunity(id, token),
  });
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      note: "",
      experience: "",
      availability: "Available for the full event",
    },
  });
  const mutation = useMutation({
    mutationFn: (values: Values) => api.apply(id, values, token),
    onSuccess: () => {
      setComplete(true);
      client.invalidateQueries({ queryKey: ["applications"] });
    },
  });
  useEffect(() => {
    if (!id || startRecorded.current) return;
    startRecorded.current = true;
    void api.trackOpportunityEvent(id, "application_started", token);
  }, [id, token]);
  if (event.isLoading)
    return (
      <Screen scroll={false}>
        <LoadingState />
      </Screen>
    );
  if (complete)
    return (
      <Screen>
        <Eyebrow>Application received</Eyebrow>
        <Display>You’ve shown up already.</Display>
        <Body className="mb-8 mt-4">
          The host will review your note. Every decision and next step will
          appear in My activities.
        </Body>
        <Card className="mb-6 border-0 bg-fern/40">
          <Text className="font-display text-xl text-ink">
            {event.data?.title}
          </Text>
          <Body className="mt-2">
            We’ll keep the status language clear: received, under review,
            confirmed, waitlisted, or declined.
          </Body>
        </Card>
        <Button
          label="View my activities"
          onPress={() => router.replace("/(volunteer)/activities")}
        />
      </Screen>
    );
  return (
    <Screen className="px-6 pb-12 pt-5">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => router.back()}
        className="mb-6 h-10 w-10 items-center justify-center rounded-full border border-border bg-card dark:border-dark-border dark:bg-dark-card"
      >
        <Ionicons name="arrow-back" size={20} color="#2A8D58" />
      </Pressable>
      <Eyebrow>Apply thoughtfully</Eyebrow>
      <Display>Tell the host how you can help.</Display>
      <Body className="mb-8 mt-3">
        Your profile email and the answers below will be shared with{" "}
        {event.data?.organisation_name}.
      </Body>
      <Controller
        control={form.control}
        name="note"
        render={({ field }) => (
          <Field
            label="Personal note"
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            placeholder="Why this activity matters to you"
            value={field.value}
            onChangeText={field.onChange}
            error={form.formState.errors.note?.message}
          />
        )}
      />
      <Controller
        control={form.control}
        name="experience"
        render={({ field }) => (
          <Field
            label="Relevant experience (optional)"
            multiline
            numberOfLines={3}
            placeholder="Skills, training, or similar volunteering"
            value={field.value}
            onChangeText={field.onChange}
          />
        )}
      />
      <Controller
        control={form.control}
        name="availability"
        render={({ field }) => (
          <AvailabilitySelect
            value={field.value}
            onChange={field.onChange}
            error={form.formState.errors.availability?.message}
          />
        )}
      />
      {mutation.error ? (
        <Text className="mb-3 font-sans text-clay">
          {mutation.error.message}
        </Text>
      ) : null}
      <Button
        label="Send application"
        loading={mutation.isPending}
        onPress={form.handleSubmit((values) => mutation.mutate(values))}
      />
    </Screen>
  );
}
