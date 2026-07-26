import { useEffect, useState } from "react";
import { Text } from "react-native";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import { supabase } from "@/lib/supabase";
import { Body, Button, Display, Eyebrow, Field, LoadingState, Screen } from "@/components/ui";

/**
 * Supabase returns recovery tokens in the URL fragment (`#access_token=…`), which
 * expo-router does not surface as search params, so the deep link is parsed here.
 */
function recoveryTokens(url: string | null) {
  if (!url) return null;
  const fragment = url.split("#")[1] ?? url.split("?")[1];
  if (!fragment) return null;
  const params = new URLSearchParams(fragment);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  return accessToken && refreshToken ? { accessToken, refreshToken } : null;
}

export default function UpdatePasswordScreen() {
  const url = Linking.useURL();
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"preparing" | "ready" | "invalid" | "saved">("preparing");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const tokens = recoveryTokens(url);
    if (!tokens) {
      // The link may still be arriving; only fail once a URL was delivered.
      if (url) setStatus("invalid");
      return;
    }
    if (!supabase) {
      setStatus("invalid");
      return;
    }
    void supabase.auth
      .setSession({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken })
      .then(({ error: sessionError }) => setStatus(sessionError ? "invalid" : "ready"));
  }, [url]);

  const submit = async () => {
    if (password.length < 8) {
      setError("Use at least 8 characters");
      return;
    }
    if (!supabase) {
      setError("Password reset is unavailable in this build.");
      return;
    }
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await supabase.auth.signOut({ scope: "local" });
    setStatus("saved");
  };

  if (status === "preparing") return <Screen scroll={false}><LoadingState label="Checking your reset link…" /></Screen>;

  if (status === "invalid") {
    return (
      <Screen>
        <Eyebrow>Account recovery</Eyebrow>
        <Display>That link has expired.</Display>
        <Body className="mb-8 mt-3">Reset links can only be used once and time out after a short while. Request a new one to continue.</Body>
        <Button label="Request a new link" onPress={() => router.replace("/auth/reset-password")} />
      </Screen>
    );
  }

  if (status === "saved") {
    return (
      <Screen>
        <Eyebrow>Account recovery</Eyebrow>
        <Display>Password updated.</Display>
        <Body className="mb-8 mt-3">Sign in with your new password to get back to GiveHub.</Body>
        <Button label="Back to sign in" onPress={() => router.replace("/welcome")} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Eyebrow>Account recovery</Eyebrow>
      <Display>Choose a new password.</Display>
      <Body className="mb-8 mt-3">Pick something you haven’t used elsewhere. You’ll sign in again once it’s saved.</Body>
      <Field
        label="New password"
        placeholder="At least 8 characters"
        secureTextEntry
        autoCapitalize="none"
        value={password}
        onChangeText={(next) => { setPassword(next); setError(null); }}
        error={error ?? undefined}
      />
      <Button label="Save new password" loading={saving} onPress={submit} />
      <Text className="mt-4 text-center font-sans text-xs text-muted-foreground dark:text-dark-muted-foreground">
        Changing your password signs you out of GiveHub on this device.
      </Text>
    </Screen>
  );
}
