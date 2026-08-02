import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Image, Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LocationPicker } from "@/components/LocationPicker";
import { Body, Button, Card, Chip, Display, ErrorState, Eyebrow, Field, LoadingState, Screen } from "@/components/ui";
import { api, demoMode } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { LocationPoint, Opportunity } from "@/lib/types";
import { useAuth } from "@/providers/AuthProvider";
import { dateInput, parseEventDateTime, scheduleError, timeInput } from "@/lib/opportunitySchedule";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const schema = z.object({
  title: z.string().min(4, "Add a clear event title"),
  description: z.string().min(20, "Add a little more detail"),
  impact: z.string(),
  tasks: z.string().min(5, "Describe the volunteer tasks"),
  meeting: z.string().min(4, "Add arrival instructions"),
  capacity: z.string().regex(/^\d+$/, "Enter a valid capacity"),
  eventDate: z.string().regex(datePattern, "Use YYYY-MM-DD"),
  startTime: z.string().regex(timePattern, "Use 24-hour time, e.g. 09:30"),
  endTime: z.string().regex(timePattern, "Use 24-hour time, e.g. 12:30"),
  causeId: z.string().min(1, "Choose a cause"),
  recurrence: z.enum(["one_off", "weekly", "monthly"]),
  effort: z.enum(["light", "moderate", "active"]),
  minimumAge: z.string().refine((value) => value === "" || /^\d+$/.test(value), "Enter a valid minimum age"),
  eligibility: z.string(),
  training: z.string(),
  screening: z.string(),
  transport: z.string(),
  qualifications: z.string(),
  accessibility: z.string(),
  safety: z.string(),
  externalUrl: z.string(),
});
type Values = z.infer<typeof schema>;

function defaultValues(): Values {
  const starts = new Date(Date.now() + 7 * 86400000);
  starts.setHours(9, 0, 0, 0);
  return {
    title: "", description: "", impact: "", tasks: "", meeting: "", capacity: "20",
    eventDate: dateInput(starts), startTime: "09:00", endTime: "12:00", causeId: "",
    recurrence: "one_off", effort: "moderate", minimumAge: "",
    eligibility: "", training: "", screening: "", transport: "",
    qualifications: "", accessibility: "", safety: "", externalUrl: "",
  };
}

function valuesFor(item: Opportunity): Values {
  const starts = new Date(item.starts_at);
  const ends = new Date(item.ends_at);
  return {
    title: item.title,
    description: item.description,
    impact: item.impact_statement,
    tasks: item.tasks,
    meeting: item.meeting_point,
    capacity: String(item.capacity),
    eventDate: dateInput(starts),
    startTime: timeInput(starts),
    endTime: timeInput(ends),
    causeId: item.causes[0]?.id ?? "",
    recurrence: item.recurrence,
    effort: item.effort as Values["effort"],
    minimumAge: String(item.minimum_age),
    eligibility: item.eligibility_notes,
    training: item.training_commitment,
    screening: item.screening_steps,
    transport: item.transportation_info,
    qualifications: item.qualifications,
    accessibility: item.accessibility,
    safety: item.safety_notes,
    externalUrl: item.external_application_url ?? "",
  };
}

export default function CreateOpportunityScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editingId = typeof id === "string" ? id : undefined;
  const { token } = useAuth();
  const client = useQueryClient();
  const [complete, setComplete] = useState(false);
  const [preview, setPreview] = useState<Values | null>(null);
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [eventLocation, setEventLocation] = useState<LocationPoint | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [requiresWaiver, setRequiresWaiver] = useState(true);
  const [isAccessible, setIsAccessible] = useState(true);
  const [trainingRequired, setTrainingRequired] = useState(false);
  const [screeningRequired, setScreeningRequired] = useState(false);
  const [applicationMode, setApplicationMode] = useState<"internal" | "external">("internal");
  const causes = useQuery({ queryKey: ["causes"], queryFn: api.causes });
  const events = useQuery({
    queryKey: ["organiser", "events"],
    queryFn: () => api.organiserOpportunities(token),
    enabled: Boolean(editingId),
  });
  const existing = useMemo(
    () => events.data?.find((item) => item.id === editingId),
    [editingId, events.data],
  );
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaultValues() });

  useEffect(() => {
    if (!existing) return;
    form.reset(valuesFor(existing));
    setEventLocation({
      label: existing.location_label, address_line: existing.address_line,
      locality: existing.locality, city: existing.city, postcode: existing.postcode,
      country_code: existing.country_code, latitude: existing.latitude, longitude: existing.longitude,
    });
    setRequiresWaiver(existing.requires_waiver);
    setIsAccessible(existing.is_accessible);
    setTrainingRequired(existing.training_required);
    setScreeningRequired(existing.screening_required);
    setApplicationMode(existing.application_mode);
  }, [existing, form]);

  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      if (!eventLocation) throw new Error("Choose the opportunity location before continuing.");
      const scheduleProblem = scheduleError(values.eventDate, values.startTime, values.endTime, !existing);
      if (scheduleProblem) throw new Error(scheduleProblem);
      const starts = parseEventDateTime(values.eventDate, values.startTime)!;
      const ends = parseEventDateTime(values.eventDate, values.endTime)!;
      if (applicationMode === "external" && !/^https?:\/\//.test(values.externalUrl)) {
        throw new Error("Enter the full organisation application URL, including https://.");
      }
      if (trainingRequired && !values.training.trim()) throw new Error("Add the required training commitment.");
      if (screeningRequired && !values.screening.trim()) throw new Error("Add the required screening steps.");
      const payload = {
        title: values.title, description: values.description,
        impact_statement: values.impact.trim() || "Community impact details will be shared by the host.",
        tasks: values.tasks, meeting_point: values.meeting,
        location_label: eventLocation.label, address_line: eventLocation.address_line,
        locality: eventLocation.locality, city: eventLocation.city, postcode: eventLocation.postcode,
        country_code: eventLocation.country_code, latitude: eventLocation.latitude,
        longitude: eventLocation.longitude, location_visibility: "public",
        starts_at: starts.toISOString(), ends_at: ends.toISOString(),
        recurrence: values.recurrence, effort: values.effort, minimum_age: Number(values.minimumAge || 0),
        accessibility: values.accessibility.trim() || "Contact the host to discuss access needs.", is_accessible: isAccessible,
        eligibility_notes: values.eligibility.trim() || "Open to all volunteers.",
        time_commitment_minutes: Math.round((ends.getTime() - starts.getTime()) / 60000),
        training_required: trainingRequired, training_commitment: values.training.trim() || "No training required.",
        screening_required: screeningRequired, screening_steps: values.screening.trim() || "No screening required.",
        transportation_info: values.transport.trim() || "Contact the host for transportation information.",
        qualifications: values.qualifications.trim() || "No prior qualifications required.",
        safety_notes: values.safety.trim() || "Follow the host’s safety briefing.", capacity: Number(values.capacity),
        requires_waiver: applicationMode === "internal" && requiresWaiver,
        listing_source: "GiveHub organiser", listing_verification_status: "verified",
        source_updated_at: new Date().toISOString(), application_mode: applicationMode,
        external_application_url: applicationMode === "external" ? values.externalUrl : null,
        cause_ids: [values.causeId],
      };
      if (existing) {
        return api.updateOpportunity(existing.id, { ...payload, version: existing.version }, token);
      }
      let event = await api.createOpportunity({
        ...payload,
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
      setComplete(true);
      void client.invalidateQueries({ queryKey: ["organiser"] });
    },
  });

  if (editingId && events.isLoading) return <Screen><LoadingState /></Screen>;
  if (editingId && events.isError) return <Screen><ErrorState error={events.error} onRetry={() => events.refetch()} /></Screen>;
  if (editingId && events.data && !existing) return <Screen><ErrorState title="Opportunity unavailable" /></Screen>;
  if (complete) return <Screen><Eyebrow>{existing ? "Updated" : "Published"}</Eyebrow><Display>{existing ? "Your changes are live." : "Your opportunity is ready to find its people."}</Display><Body className="mb-7 mt-4">Volunteers now see the schedule, fit information, and application process you reviewed.</Body><Button label="Back to overview" onPress={() => router.replace("/(organiser)")} /></Screen>;

  const field = (name: keyof Values, label: string, placeholder: string, multiline = false, required = false) => (
    <Controller control={form.control} name={name} render={({ field: input }) => (
      <Field label={`${label}${required ? " *" : " (optional)"}`} placeholder={placeholder} multiline={multiline} numberOfLines={multiline ? 4 : 1}
        textAlignVertical={multiline ? "top" : "center"} value={String(input.value)} onChangeText={(value) => { input.onChange(value); setPreview(null); }}
        error={form.formState.errors[name]?.message} keyboardType={["capacity", "minimumAge"].includes(name) ? "number-pad" : name === "externalUrl" ? "url" : "default"}
        autoCapitalize={name === "externalUrl" ? "none" : "sentences"} />
    )} />
  );

  if (preview) {
    const starts = parseEventDateTime(preview.eventDate, preview.startTime)!;
    const ends = parseEventDateTime(preview.eventDate, preview.endTime)!;
    const cause = causes.data?.find((item) => item.id === preview.causeId)?.name ?? "Selected cause";
    return <Screen>
      <Eyebrow>Review before {existing ? "saving" : "publishing"}</Eyebrow>
      <Display>{preview.title}</Display>
      <Body className="mt-3">{preview.description}</Body>
      {preview.impact ? <Card className="my-6 border-0 bg-secondary dark:bg-dark-secondary"><Eyebrow>Your impact</Eyebrow><Text className="font-display text-xl text-foreground dark:text-dark-foreground">{preview.impact}</Text></Card> : null}
      <Card className="mb-5">
        <Text className="font-strong text-base text-foreground dark:text-dark-foreground">Schedule and fit</Text>
        <Body className="mt-2">{starts.toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</Body>
        <Body>{preview.startTime}–{preview.endTime} · {preview.recurrence.replace("_", " ")} · {preview.effort}</Body>
        <Body className="mt-2">{eventLocation?.label} · {cause} · {preview.minimumAge ? `minimum age ${preview.minimumAge}` : "all ages"}</Body>
      </Card>
      <Card className="mb-5"><Text className="font-strong text-base text-foreground dark:text-dark-foreground">Volunteer information</Text><Body className="mt-2">Tasks: {preview.tasks}</Body>{preview.accessibility ? <Body className="mt-2">Access: {preview.accessibility}</Body> : null}{preview.safety ? <Body className="mt-2">Safety: {preview.safety}</Body> : null}{preview.training ? <Body className="mt-2">Training: {preview.training}</Body> : null}{preview.screening ? <Body className="mt-2">Screening: {preview.screening}</Body> : null}</Card>
      <Card className="mb-5"><Text className="font-strong text-base text-foreground dark:text-dark-foreground">Application process</Text><Body className="mt-2">{applicationMode === "internal" ? "Applications are stored by GiveHub and shared with your organisation." : `Applicants continue to ${preview.externalUrl}; GiveHub stores no form answers.`}</Body></Card>
      {mutation.error ? <Text accessibilityRole="alert" className="mb-3 font-sans text-sm text-destructive dark:text-dark-destructive">{mutation.error.message}</Text> : null}
      <Button label={existing ? "Save changes" : "Publish opportunity"} loading={mutation.isPending} onPress={() => mutation.mutate(preview)} />
      <Button label="Back to editing" variant="secondary" className="mt-3" onPress={() => setPreview(null)} />
    </Screen>;
  }

  const review = form.handleSubmit((values) => {
    if (!eventLocation) return setFormError("Choose the opportunity location before continuing.");
    const scheduleProblem = scheduleError(values.eventDate, values.startTime, values.endTime, !existing);
    if (scheduleProblem) return setFormError(scheduleProblem);
    if (applicationMode === "external" && !/^https?:\/\//.test(values.externalUrl)) return setFormError("Enter the full organisation application URL, including https://.");
    if (trainingRequired && !values.training.trim()) return setFormError("Add the required training commitment.");
    if (screeningRequired && !values.screening.trim()) return setFormError("Add the required screening steps.");
    setFormError(null);
    setPreview(values);
  });

  return <Screen>
    <Eyebrow>{existing ? "Edit opportunity" : "Post opportunity"}</Eyebrow>
    <Display>{existing ? "Keep the listing accurate." : "Give people enough detail to say yes."}</Display>
    <Body className="mb-7 mt-3">Set the real schedule and volunteer fit, then review exactly what people will see.</Body>
    <Body className="mb-5">Fields marked with * are needed. Everything else is optional and can be added later.</Body>
    {!existing ? <Pressable accessibilityRole="button" accessibilityLabel="Choose opportunity image, optional" onPress={async () => { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [4, 3], quality: 0.85 }); if (!result.canceled) setImage(result.assets[0] ?? null); }} className="mb-5 h-52 overflow-hidden rounded-card border border-dashed border-primary bg-secondary active:opacity-80 dark:border-dark-primary dark:bg-dark-secondary">{image ? <Image source={{ uri: image.uri }} className="h-full w-full" resizeMode="cover" /> : <Text className="m-auto font-medium text-sm text-primary dark:text-dark-primary">Choose an event image (optional)</Text>}</Pressable> : null}
    {field("title", "Event title", "e.g. Harbour planting morning", false, true)}
    {field("description", "Description", "What is happening and why?", true, true)}
    {field("impact", "Impact statement", "What will this change?", true)}
    {field("tasks", "Volunteer tasks", "What will volunteers actually do?", true, true)}
    <Text className="mb-3 mt-2 font-display text-xl text-foreground dark:text-dark-foreground">Schedule</Text>
    {field("eventDate", "Event date", "YYYY-MM-DD", false, true)}
    <View className="flex-row gap-3"><View className="flex-1">{field("startTime", "Start time", "09:00", false, true)}</View><View className="flex-1">{field("endTime", "End time", "12:00", false, true)}</View></View>
    <Controller control={form.control} name="recurrence" render={({ field: input }) => <Card className="mb-4"><Text className="mb-2 font-medium text-sm text-foreground dark:text-dark-foreground">Frequency *</Text><View className="flex-row flex-wrap gap-y-2">{(["one_off", "weekly", "monthly"] as const).map((value) => <Chip key={value} label={value.replace("_", " ")} selected={input.value === value} onPress={() => input.onChange(value)} />)}</View></Card>} />
    <LocationPicker title="Opportunity address *" value={eventLocation} onChange={(next) => { setEventLocation(next); setFormError(null); setPreview(null); }} token={token} />
    {field("meeting", "Arrival instructions", "e.g. Meet beside the north entrance", false, true)}
    <Text className="mb-3 mt-2 font-display text-xl text-foreground dark:text-dark-foreground">Volunteer fit</Text>
    <Controller control={form.control} name="causeId" render={({ field: input }) => <Card className="mb-4"><Text className="mb-2 font-medium text-sm text-foreground dark:text-dark-foreground">Cause *</Text><View className="flex-row flex-wrap gap-y-2">{causes.data?.map((cause) => <Chip key={cause.id} label={cause.name} selected={input.value === cause.id} onPress={() => input.onChange(cause.id)} />)}</View>{form.formState.errors.causeId ? <Text accessibilityRole="alert" className="mt-2 font-sans text-sm text-destructive dark:text-dark-destructive">{form.formState.errors.causeId.message}</Text> : null}</Card>} />
    <Controller control={form.control} name="effort" render={({ field: input }) => <Card className="mb-4"><Text className="mb-2 font-medium text-sm text-foreground dark:text-dark-foreground">Activity level *</Text><View className="flex-row flex-wrap gap-y-2">{(["light", "moderate", "active"] as const).map((value) => <Chip key={value} label={value} selected={input.value === value} onPress={() => input.onChange(value)} />)}</View></Card>} />
    <View className="flex-row gap-3"><View className="flex-1">{field("capacity", "Volunteer places", "20", false, true)}</View><View className="flex-1">{field("minimumAge", "Minimum age", "e.g. 16")}</View></View>
    {field("eligibility", "Eligibility", "Who is this suitable for?", true)}
    {field("accessibility", "Accessibility", "Step-free access, adaptable tasks, facilities", true)}
    <Card className="mb-4"><Text className="mb-2 font-medium text-sm text-foreground dark:text-dark-foreground">Accessible opportunity *</Text><View className="flex-row"><Chip label="Yes" selected={isAccessible} onPress={() => setIsAccessible(true)} /><Chip label="No / limited" selected={!isAccessible} onPress={() => setIsAccessible(false)} /></View></Card>
    <Card className="mb-4"><Text className="mb-2 font-medium text-sm text-foreground dark:text-dark-foreground">Training required *</Text><View className="flex-row"><Chip label="No" selected={!trainingRequired} onPress={() => setTrainingRequired(false)} /><Chip label="Yes" selected={trainingRequired} onPress={() => setTrainingRequired(true)} /></View></Card>
    {field("training", "Training commitment", "What training is required?", true, trainingRequired)}
    <Card className="mb-4"><Text className="mb-2 font-medium text-sm text-foreground dark:text-dark-foreground">Screening required *</Text><View className="flex-row"><Chip label="No" selected={!screeningRequired} onPress={() => setScreeningRequired(false)} /><Chip label="Yes" selected={screeningRequired} onPress={() => setScreeningRequired(true)} /></View></Card>
    {field("screening", "Screening steps", "Police check, references, interview, or none", true, screeningRequired)}
    {field("transport", "Transportation", "Public transport, parking, pickup options", true)}
    {field("qualifications", "Required or preferred qualifications", "Say if none are needed", true)}
    {field("safety", "Safety and what to bring", "Equipment, clothing, hazards, and briefing", true)}
    <Card className="mb-5"><Text className="mb-1 font-medium text-sm text-foreground dark:text-dark-foreground">Where volunteers apply *</Text><Body className="mb-3">Internal applications are stored by GiveHub. External applications open your organisation’s form, and GiveHub stores no answers.</Body><View className="flex-row flex-wrap gap-y-2"><Chip label="GiveHub" selected={applicationMode === "internal"} onPress={() => setApplicationMode("internal")} /><Chip label="Organisation website" selected={applicationMode === "external"} onPress={() => setApplicationMode("external")} /></View></Card>
    {applicationMode === "external" ? field("externalUrl", "Organisation application URL", "https://…", false, true) : null}
    {applicationMode === "internal" ? <Card className="mb-5"><Text className="mb-1 font-medium text-sm text-foreground dark:text-dark-foreground">Volunteer agreement *</Text><Body className="mb-3">Volunteers sign your agreement before applying.</Body><View className="flex-row"><Chip label="Required" selected={requiresWaiver} onPress={() => setRequiresWaiver(true)} /><Chip label="Not required" selected={!requiresWaiver} onPress={() => setRequiresWaiver(false)} /></View></Card> : null}
    {formError ? <Text accessibilityRole="alert" className="mb-3 font-sans text-sm text-destructive dark:text-dark-destructive">{formError}</Text> : null}
    <Button label={existing ? "Review changes" : "Review opportunity"} onPress={review} />
  </Screen>;
}
