import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Image, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LocationPicker } from "@/components/LocationPicker";
import { Body, Button, Card, Chip, Display, Eyebrow, Field, Screen } from "@/components/ui";
import { api, demoMode } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { LocationPoint } from "@/lib/types";
import { useAuth } from "@/providers/AuthProvider";

const schema = z.object({
  title: z.string().min(4),
  description: z.string().min(20),
  impact: z.string().min(8),
  tasks: z.string().min(5),
  meeting: z.string().min(4),
  capacity: z.string().regex(/^\d+$/, "Enter a valid capacity"),
});
type Values = z.infer<typeof schema>;

export default function CreateOpportunityScreen() {
  const { token } = useAuth();
  const client = useQueryClient();
  const [published, setPublished] = useState(false);
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [eventLocation, setEventLocation] = useState<LocationPoint | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [requiresWaiver, setRequiresWaiver] = useState(true);
  const causes = useQuery({ queryKey: ["causes"], queryFn: api.causes });
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", description: "", impact: "", tasks: "", meeting: "", capacity: "20" },
  });

  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      if (!eventLocation) throw new Error("Choose the opportunity location before publishing.");
      const causeId = causes.data?.[0]?.id;
      if (!causeId) {
        throw new Error(
          causes.isError
            ? "GiveHub could not load causes. Check your connection and try again."
            : "Causes are still loading. Try again in a moment.",
        );
      }
      const starts = new Date(Date.now() + 7 * 86400000);
      const ends = new Date(starts.getTime() + 3 * 3600000);
      let event = await api.createOpportunity({
        title: values.title,
        description: values.description,
        impact_statement: values.impact,
        tasks: values.tasks,
        meeting_point: values.meeting,
        location_label: eventLocation.label,
        address_line: eventLocation.address_line,
        locality: eventLocation.locality,
        city: eventLocation.city,
        postcode: eventLocation.postcode,
        country_code: eventLocation.country_code,
        latitude: eventLocation.latitude,
        longitude: eventLocation.longitude,
        location_visibility: "public",
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        recurrence: "one_off",
        effort: "moderate",
        minimum_age: 16,
        accessibility: "Contact the host to discuss access needs.",
        safety_notes: "Closed shoes and water recommended.",
        capacity: Number(values.capacity),
        requires_waiver: requiresWaiver,
        cause_ids: [causeId],
        image_url: image?.uri ?? "https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=1200&q=85",
      }, token);
      if (image && !demoMode && supabase) {
        const filename = image.fileName ?? `opportunity-${Date.now()}.jpg`;
        const contentType = image.mimeType ?? "image/jpeg";
        const blob = await (await fetch(image.uri)).blob();
        const upload = await api.imageUpload(event.id, { filename, content_type: contentType, size_bytes: image.fileSize ?? blob.size }, token);
        const bucket = process.env.EXPO_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "opportunity-images";
        const { error } = await supabase.storage.from(bucket).uploadToSignedUrl(upload.path, upload.token, blob, { contentType });
        if (error) throw error;
        event = await api.updateOpportunity(event.id, { image_url: upload.public_url, version: event.version }, token);
      }
      return api.publishOpportunity(event.id, token);
    },
    onSuccess: () => {
      setPublished(true);
      client.invalidateQueries({ queryKey: ["organiser"] });
    },
  });

  if (published) return <Screen><Eyebrow>Published</Eyebrow><Display>Your opportunity is ready to find its people.</Display><Body className="mb-7 mt-4">It now appears on the organiser overview and in volunteer discovery. New applications will enter its own pipeline.</Body><Button label="Back to overview" onPress={() => router.replace("/(organiser)")} /></Screen>;

  const field = (name: keyof Values, label: string, placeholder: string, multiline = false) => <Controller control={form.control} name={name} render={({ field: input }) => <Field label={label} placeholder={placeholder} multiline={multiline} numberOfLines={multiline ? 4 : 1} textAlignVertical={multiline ? "top" : "center"} value={String(input.value)} onChangeText={input.onChange} error={form.formState.errors[name]?.message} keyboardType={name === "capacity" ? "number-pad" : "default"} />} />;

  return <Screen>
    <Eyebrow>Post opportunity</Eyebrow>
    <Display>Give people enough detail to say yes.</Display>
    <Body className="mb-7 mt-3">This beta publishes review-required applications with a clear capacity and event plan.</Body>
    <Pressable accessibilityRole="button" accessibilityLabel="Choose opportunity image" onPress={async () => { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [4, 3], quality: 0.85 }); if (!result.canceled) setImage(result.assets[0] ?? null); }} className="mb-5 h-52 overflow-hidden rounded-card border border-dashed border-primary bg-secondary active:opacity-80 dark:border-dark-primary dark:bg-dark-secondary">{image ? <Image source={{ uri: image.uri }} className="h-full w-full" resizeMode="cover" /> : <Text className="m-auto font-medium text-sm text-primary dark:text-dark-primary">Choose an event image</Text>}</Pressable>
    {field("title", "Event title", "e.g. Harbour planting morning")}
    {field("description", "Description", "What is happening and why?", true)}
    {field("impact", "Impact statement", "What will this change?", true)}
    {field("tasks", "Volunteer tasks", "What will volunteers actually do?", true)}
    <LocationPicker title="Opportunity address" value={eventLocation} onChange={(next) => { setEventLocation(next); setLocationError(null); }} token={token} />
    {field("meeting", "Arrival instructions", "e.g. Meet beside the north entrance")}
    {field("capacity", "Volunteer places", "20")}
    <Card className="mb-5">
      <Text className="mb-1 font-medium text-sm text-foreground dark:text-dark-foreground">Volunteer agreement</Text>
      <Body className="mb-3">Volunteers sign your agreement before applying. Turn this off only for activities with no physical risk.</Body>
      <View className="flex-row">
        <Chip label="Required" selected={requiresWaiver} onPress={() => setRequiresWaiver(true)} />
        <Chip label="Not required" selected={!requiresWaiver} onPress={() => setRequiresWaiver(false)} />
      </View>
    </Card>
    <Card className="mb-5 border-0 bg-secondary dark:bg-dark-secondary"><Text className="font-medium text-sm text-foreground dark:text-dark-foreground">Publishing checklist</Text><Body className="mt-2">Access information · safety notes · review expectations · precise event location</Body></Card>
    {locationError || mutation.error ? <Text accessibilityRole="alert" className="mb-3 font-sans text-sm text-destructive dark:text-dark-destructive">{locationError ?? mutation.error?.message}</Text> : null}
    <Button label="Publish opportunity" loading={mutation.isPending} onPress={form.handleSubmit((values) => { if (!eventLocation) { setLocationError("Choose the opportunity location before publishing."); return; } mutation.mutate(values); })} />
  </Screen>;
}
