import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Display, Field, Screen, Body, Eyebrow } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import type { Role } from "@/lib/types";

const schema = z.object({
  name: z.string(),
  organisationName: z.string(),
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters"),
});
type FormData = z.infer<typeof schema>;

export default function AuthScreen() {
  const { role: roleParam } = useLocalSearchParams<{ role: string }>();
  const role: Role = roleParam === "organiser" ? "organiser" : "volunteer";
  const [signIn, setSignIn] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { signIn: login, signUp } = useAuth();
  const { control, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema), defaultValues: { name: "", organisationName: "", email: "", password: "" },
  });
  const organiser = role === "organiser";
  const submit = handleSubmit(async (data) => {
    setSubmitError(null);
    if (!signIn && !organiser && data.name.trim().length < 2) { setError("name", { message: "Enter your name" }); return; }
    if (!signIn && organiser && data.organisationName.trim().length < 2) { setError("organisationName", { message: "Enter your organisation name" }); return; }
    try {
      if (signIn) await login(role, data.email, data.password);
      else await signUp({ role, name: organiser ? data.organisationName || data.name : data.name, email: data.email, password: data.password, organisationName: data.organisationName });
      router.replace(organiser ? "/(organiser)" : "/(volunteer)");
    } catch (error) { setSubmitError(error instanceof Error ? error.message : "Please try again"); }
  });
  return (
    <Screen>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} className="mb-8 h-11 w-11 items-center justify-center rounded-full border border-ink/10 dark:border-paper/10"><Ionicons name="arrow-back" size={22} color="#2D945D" /></Pressable>
      <Eyebrow>{organiser ? "For organisers" : "For volunteers"}</Eyebrow>
      <Display>{signIn ? "Welcome back." : `Create your ${role} account.`}</Display>
      <Body className="mb-8 mt-3">{organiser ? "Publish trusted opportunities, guide each applicant, and keep your roster in sync." : "Save opportunities, make considered applications, and know exactly what happens next."}</Body>
      {!signIn && !organiser ? <Controller control={control} name="name" render={({ field }) => <Field label="Your name" placeholder="Your full name" value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} error={errors.name?.message} />} /> : null}
      {!signIn && organiser ? <Controller control={control} name="organisationName" render={({ field }) => <Field label="Organisation name" placeholder="e.g. Kaitiaki Coastal Network" value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} error={errors.organisationName?.message} />} /> : null}
      <Controller control={control} name="email" render={({ field }) => <Field label="Email address" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} error={errors.email?.message} />} />
      <Controller control={control} name="password" render={({ field }) => <Field label="Password" placeholder="At least 8 characters" secureTextEntry value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} error={errors.password?.message} />} />
      {submitError ? <Text accessibilityRole="alert" className="mb-4 font-sans text-clay">{submitError}</Text> : null}
      {!signIn ? <View className="mb-5 rounded-2xl bg-fern/40 p-4"><Text className="font-sans text-sm leading-5 text-ink/70">{organiser ? "Organiser accounts are auto-approved during the beta; verification status is retained for launch." : "You control what hosts see in each application."}</Text></View> : null}
      <Button label={signIn ? `${organiser ? "Organiser" : "Volunteer"} sign in` : "Create account"} onPress={submit} loading={isSubmitting} />
      <Pressable onPress={() => setSignIn((value) => !value)} className="min-h-14 items-center justify-center"><Text className="font-medium text-moss dark:text-fern">{signIn ? "Need an account? Create one" : "Already have an account? Sign in"}</Text></Pressable>
      {signIn ? <Pressable onPress={() => router.push("/auth/reset-password")} className="min-h-11 items-center"><Text className="font-sans text-sm text-ink/60 dark:text-paper/60">Forgot password?</Text></Pressable> : null}
    </Screen>
  );
}
