import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { router, useLocalSearchParams } from "expo-router";
import { Text } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { Body, Button, Card, Display, Eyebrow, Field, LoadingState, Screen } from "@/components/ui";

const schema = z.object({ note: z.string().min(10, "Tell the host a little more"), experience: z.string(), availability: z.string().min(3, "Add your availability") });
type Values = z.infer<typeof schema>;
export default function ApplyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const { token } = useAuth(); const client = useQueryClient(); const [complete, setComplete] = useState(false);
  const event = useQuery({ queryKey: ["opportunity", id], queryFn: () => api.opportunity(id, token) });
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { note: "", experience: "", availability: "Available for the full event" } });
  const mutation = useMutation({ mutationFn: (values: Values) => api.apply(id, values, token), onSuccess: () => { setComplete(true); client.invalidateQueries({ queryKey: ["applications"] }); } });
  if (event.isLoading) return <Screen scroll={false}><LoadingState /></Screen>;
  if (complete) return <Screen><Eyebrow>Application received</Eyebrow><Display>You’ve shown up already.</Display><Body className="mb-8 mt-4">The host will review your note. Every decision and next step will appear in My activities.</Body><Card className="mb-6 border-0 bg-fern/40"><Text className="font-display text-xl text-ink">{event.data?.title}</Text><Body className="mt-2">We’ll keep the status language clear: received, under review, confirmed, waitlisted, or declined.</Body></Card><Button label="View my activities" onPress={() => router.replace("/(volunteer)/activities")} /></Screen>;
  return <Screen><Eyebrow>Apply thoughtfully</Eyebrow><Display>Tell the host how you can help.</Display><Body className="mb-7 mt-3">Your profile email and the answers below will be shared with {event.data?.organisation_name}.</Body><Controller control={form.control} name="note" render={({ field }) => <Field label="Personal note" multiline numberOfLines={5} textAlignVertical="top" placeholder="Why this activity matters to you" value={field.value} onChangeText={field.onChange} error={form.formState.errors.note?.message} />} /><Controller control={form.control} name="experience" render={({ field }) => <Field label="Relevant experience (optional)" multiline numberOfLines={3} value={field.value} onChangeText={field.onChange} />} /><Controller control={form.control} name="availability" render={({ field }) => <Field label="Availability" value={field.value} onChangeText={field.onChange} error={form.formState.errors.availability?.message} />} />{mutation.error ? <Text className="mb-3 font-sans text-clay">{mutation.error.message}</Text> : null}<Button label="Send application" loading={mutation.isPending} onPress={form.handleSubmit((values) => mutation.mutate(values))} /></Screen>;
}

