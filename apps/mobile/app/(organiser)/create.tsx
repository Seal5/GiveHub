import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Image, Pressable, Text } from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { demoMode } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Body, Button, Card, Display, Eyebrow, Field, Screen } from "@/components/ui";

const schema = z.object({ title: z.string().min(4), description: z.string().min(20), impact: z.string().min(8), tasks: z.string().min(5), meeting: z.string().min(4), capacity: z.string().regex(/^\d+$/, "Enter a valid capacity") });
type Values = z.infer<typeof schema>;
export default function CreateOpportunityScreen() {
  const { token } = useAuth(); const client = useQueryClient(); const [published, setPublished] = useState(false); const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const suburbs = useQuery({ queryKey: ["suburbs"], queryFn: api.suburbs }); const causes = useQuery({ queryKey: ["causes"], queryFn: api.causes });
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { title: "", description: "", impact: "", tasks: "", meeting: "", capacity: "20" } });
  const mutation = useMutation({ mutationFn: async (values: Values) => {
    const starts = new Date(Date.now() + 7 * 86400000); const ends = new Date(starts.getTime() + 3 * 3600000);
    let event = await api.createOpportunity({ title: values.title, description: values.description, impact_statement: values.impact, tasks: values.tasks, suburb_id: suburbs.data?.[0]?.id, meeting_point: values.meeting, starts_at: starts.toISOString(), ends_at: ends.toISOString(), recurrence: "one_off", effort: "moderate", minimum_age: 16, accessibility: "Contact the host to discuss access needs.", safety_notes: "Closed shoes and water recommended.", capacity: Number(values.capacity), cause_ids: [causes.data?.[0]?.id], image_url: image?.uri ?? "https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=1200&q=85" }, token);
    if (image && !demoMode && supabase) {
      const filename = image.fileName ?? `opportunity-${Date.now()}.jpg`; const contentType = image.mimeType ?? "image/jpeg"; const blob = await (await fetch(image.uri)).blob();
      const upload = await api.imageUpload(event.id, { filename, content_type: contentType, size_bytes: image.fileSize ?? blob.size }, token);
      const bucket = process.env.EXPO_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "opportunity-images";
      const { error } = await supabase.storage.from(bucket).uploadToSignedUrl(upload.path, upload.token, blob, { contentType });
      if (error) throw error;
      event = await api.updateOpportunity(event.id, { image_url: upload.public_url, version: event.version }, token);
    }
    return api.publishOpportunity(event.id, token);
  }, onSuccess: () => { setPublished(true); client.invalidateQueries({ queryKey: ["organiser"] }); } });
  if (published) return <Screen><Eyebrow>Published</Eyebrow><Display>Your opportunity is ready to find its people.</Display><Body className="mb-7 mt-4">It now appears on the organiser overview and in volunteer discovery. New applications will enter its own pipeline.</Body><Button label="Back to overview" onPress={() => router.replace("/(organiser)")} /></Screen>;
  const field = (name: keyof Values, label: string, placeholder: string, multiline = false) => <Controller control={form.control} name={name} render={({ field: input }) => <Field label={label} placeholder={placeholder} multiline={multiline} numberOfLines={multiline ? 4 : 1} textAlignVertical={multiline ? "top" : "center"} value={String(input.value)} onChangeText={input.onChange} error={form.formState.errors[name]?.message} keyboardType={name === "capacity" ? "number-pad" : "default"} />} />;
  return <Screen><Eyebrow>Post opportunity</Eyebrow><Display>Give people enough detail to say yes.</Display><Body className="mb-7 mt-3">This beta publishes review-required applications with a clear capacity and event plan.</Body><Pressable accessibilityRole="button" accessibilityLabel="Choose opportunity image" onPress={async () => { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [4, 3], quality: 0.85 }); if (!result.canceled) setImage(result.assets[0] ?? null); }} className="mb-5 h-52 overflow-hidden rounded-card border border-dashed border-moss bg-fern/20">{image ? <Image source={{ uri: image.uri }} className="h-full w-full" resizeMode="cover" /> : <Text className="m-auto font-medium text-moss">Choose an event image</Text>}</Pressable>{field("title", "Event title", "e.g. Harbour planting morning")}{field("description", "Description", "What is happening and why?", true)}{field("impact", "Impact statement", "What will this change?", true)}{field("tasks", "Volunteer tasks", "What will volunteers actually do?", true)}{field("meeting", "Meeting point", "Clear arrival instructions")}{field("capacity", "Volunteer places", "20")}
    <Card className="mb-5 border-0 bg-fern/40"><Text className="font-medium text-ink">Publishing checklist</Text><Body className="mt-2">Access information · safety notes · review expectations · Wellington location</Body></Card>{mutation.error ? <Text className="mb-3 font-sans text-clay">{mutation.error.message}</Text> : null}<Button label="Publish opportunity" loading={mutation.isPending} onPress={form.handleSubmit((values) => mutation.mutate(values))} />
  </Screen>;
}
