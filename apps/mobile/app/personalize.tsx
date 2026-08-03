import { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PersonalizationPreferences } from "@/lib/types";
import { useAuth } from "@/providers/AuthProvider";
import { Body, Button, Card, Chip, Display, Eyebrow, IconButton, LoadingState, Screen } from "@/components/ui";

const availabilityOptions = [
  ["weekday_morning", "Weekday mornings"],
  ["weekday_afternoon", "Weekday afternoons"],
  ["weekday_evening", "Weekday evenings"],
  ["weekend_morning", "Weekend mornings"],
  ["weekend_afternoon", "Weekend afternoons"],
  ["weekend_evening", "Weekend evenings"],
] as const;

const toggle = <T extends string>(items: T[], value: T) => items.includes(value) ? items.filter((item) => item !== value) : [...items, value];

export default function PersonalizeScreen() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const editing = edit === "true";
  const { profile, token, refreshProfile } = useAuth();
  const client = useQueryClient();
  const causes = useQuery({ queryKey: ["causes"], queryFn: api.causes });
  const [causeSlugs, setCauseSlugs] = useState(profile?.preferred_cause_slugs ?? []);
  const [availability, setAvailability] = useState(profile?.preferred_availability ?? []);
  const [recurrences, setRecurrences] = useState<PersonalizationPreferences["preferred_recurrences"]>(profile?.preferred_recurrences ?? []);
  const [duration, setDuration] = useState<number | null>(profile?.max_time_commitment_minutes ?? null);
  const [accessibleOnly, setAccessibleOnly] = useState(profile?.accessible_only ?? false);
  const [ageGroup, setAgeGroup] = useState<PersonalizationPreferences["age_group"]>(profile?.age_group ?? null);
  const [training, setTraining] = useState<PersonalizationPreferences["training_preference"]>(profile?.training_preference ?? "any");
  const [screening, setScreening] = useState<PersonalizationPreferences["screening_preference"]>(profile?.screening_preference ?? "any");
  const [transportation, setTransportation] = useState<PersonalizationPreferences["transportation_preference"]>(profile?.transportation_preference ?? "any");

  const finish = async () => {
    await refreshProfile();
    await client.invalidateQueries({ queryKey: ["opportunities"] });
    if (editing) router.back(); else router.replace("/(volunteer)");
  };
  const save = useMutation({
    mutationFn: (preferences: PersonalizationPreferences) => api.updatePreferences({
      search_location_label: profile?.search_location_label ?? null,
      search_latitude: profile?.search_latitude ?? null,
      search_longitude: profile?.search_longitude ?? null,
      search_radius_km: profile?.search_radius_km ?? 25,
      theme: profile?.theme ?? "system",
      ...preferences,
    }, token),
    onSuccess: finish,
  });
  const preferences = (skip = false): PersonalizationPreferences => ({
    onboarding_completed: true,
    preferred_cause_slugs: skip ? [] : causeSlugs,
    preferred_availability: skip ? [] : availability,
    preferred_recurrences: skip ? [] : recurrences,
    max_time_commitment_minutes: skip ? null : duration,
    accessible_only: skip ? false : accessibleOnly,
    age_group: skip ? null : ageGroup,
    training_preference: skip ? "any" : training,
    screening_preference: skip ? "any" : screening,
    transportation_preference: skip ? "any" : transportation,
  });

  if (!profile || causes.isLoading) return <Screen scroll={false}><LoadingState /></Screen>;
  return (
    <Screen className="px-5 pb-10 pt-3">
      {editing ? <IconButton icon="close" label="Close personalization" className="mb-6" onPress={() => router.back()} /> : null}
      <Eyebrow>{editing ? "Your matching preferences" : "One optional step"}</Eyebrow>
      <Display className="text-[30px] leading-8">Make GiveHub feel like yours.</Display>
      <Body className="mb-7 mt-3">Choose anything that matters to you. Every question is optional, and you can change these answers later.</Body>

      <Card className="mb-4">
        <Text className="mb-1 font-strong text-sm text-foreground dark:text-dark-foreground">Causes you care about</Text>
        <Body className="mb-3">Select as many as you like.</Body>
        <View className="flex-row flex-wrap gap-y-2">
          {causes.data?.map((cause) => <Chip key={cause.slug} label={cause.name} selected={causeSlugs.includes(cause.slug)} onPress={() => setCauseSlugs(toggle(causeSlugs, cause.slug))} />)}
        </View>
      </Card>

      <Card className="mb-4">
        <Text className="mb-1 font-strong text-sm text-foreground dark:text-dark-foreground">When are you usually free?</Text>
        <Body className="mb-3">These are general preferences, not a commitment.</Body>
        <View className="flex-row flex-wrap gap-y-2">
          {availabilityOptions.map(([value, label]) => <Chip key={value} label={label} selected={availability.includes(value)} onPress={() => setAvailability(toggle(availability, value))} />)}
        </View>
      </Card>

      <Card className="mb-4">
        <Text className="mb-3 font-strong text-sm text-foreground dark:text-dark-foreground">Opportunity frequency</Text>
        <View className="flex-row flex-wrap gap-y-2">
          {([['one_off', 'One-time'], ['weekly', 'Weekly'], ['monthly', 'Monthly']] as const).map(([value, label]) => <Chip key={value} label={label} selected={recurrences.includes(value)} onPress={() => setRecurrences(toggle(recurrences, value))} />)}
        </View>
      </Card>

      <Card className="mb-4">
        <Text className="mb-3 font-strong text-sm text-foreground dark:text-dark-foreground">Time per opportunity</Text>
        <View className="flex-row flex-wrap gap-y-2">
          {([[null, "Any length"], [120, "Up to 2 hours"], [240, "Up to 4 hours"], [480, "Up to a day"]] as const).map(([value, label]) => <Chip key={label} label={label} selected={duration === value} onPress={() => setDuration(value)} />)}
        </View>
      </Card>

      <Card className="mb-4">
        <Text className="mb-3 font-strong text-sm text-foreground dark:text-dark-foreground">Access and eligibility</Text>
        <View className="flex-row flex-wrap gap-y-2">
          <Chip label="Any accessibility" selected={!accessibleOnly} onPress={() => setAccessibleOnly(false)} />
          <Chip label="Accessible listings only" selected={accessibleOnly} onPress={() => setAccessibleOnly(true)} />
        </View>
        <Text className="mb-2 mt-5 font-strong text-xs uppercase tracking-[1.3px] text-muted-foreground dark:text-dark-muted-foreground">Age group</Text>
        <View className="flex-row flex-wrap gap-y-2">
          {([[null, "Prefer not to say"], ["under_16", "Under 16"], ["16_17", "16–17"], ["18_plus", "18+"]] as const).map(([value, label]) => <Chip key={label} label={label} selected={ageGroup === value} onPress={() => setAgeGroup(value)} />)}
        </View>
      </Card>

      <Card className="mb-4">
        <Text className="mb-2 font-strong text-sm text-foreground dark:text-dark-foreground">Training</Text>
        <View className="flex-row flex-wrap gap-y-2">{([['any', 'No preference'], ['avoid', 'Prefer none'], ['open', 'Open to training']] as const).map(([value, label]) => <Chip key={value} label={label} selected={training === value} onPress={() => setTraining(value)} />)}</View>
        <Text className="mb-2 mt-5 font-strong text-sm text-foreground dark:text-dark-foreground">Screening or background checks</Text>
        <View className="flex-row flex-wrap gap-y-2">{([['any', 'No preference'], ['avoid', 'Prefer none'], ['open', 'Open to screening']] as const).map(([value, label]) => <Chip key={value} label={label} selected={screening === value} onPress={() => setScreening(value)} />)}</View>
      </Card>

      <Card className="mb-7">
        <Text className="mb-3 font-strong text-sm text-foreground dark:text-dark-foreground">Getting there</Text>
        <View className="flex-row flex-wrap gap-y-2">{([['any', 'Any transport'], ['transit', 'Public transit'], ['walk_bike', 'Walk or bike'], ['drive', 'Driving']] as const).map(([value, label]) => <Chip key={value} label={label} selected={transportation === value} onPress={() => setTransportation(value)} />)}</View>
      </Card>

      {causes.isError || save.error ? <Text accessibilityRole="alert" className="mb-3 font-sans text-sm text-destructive dark:text-dark-destructive">{save.error?.message ?? "We couldn’t load causes. Try again."}</Text> : null}
      <Button label={editing ? "Save matching preferences" : "Show my matches"} loading={save.isPending} onPress={() => save.mutate(preferences())} />
      {!editing ? <Button label="Skip for now" variant="secondary" className="mt-3" disabled={save.isPending} onPress={() => save.mutate(preferences(true))} /> : null}
    </Screen>
  );
}
