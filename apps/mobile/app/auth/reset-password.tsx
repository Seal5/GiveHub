import { useState } from "react";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { Button, Display, Field, Screen, Body, Eyebrow } from "@/components/ui";

export default function ResetPasswordScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const submit = async () => {
    if (supabase) await supabase.auth.resetPasswordForEmail(email, { redirectTo: "givehub://auth/update-password" });
    setSent(true);
  };
  return <Screen><Eyebrow>Account recovery</Eyebrow><Display>{sent ? "Check your inbox." : "Reset your password."}</Display><Body className="mb-8 mt-3">{sent ? "If that address has a GiveHub account, a secure reset link is on its way." : "We’ll email you a secure link to choose a new password."}</Body>{!sent ? <><Field label="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" /><Button label="Send reset link" onPress={submit} /></> : <Button label="Back to GiveHub" onPress={() => router.replace("/")} />}</Screen>;
}

