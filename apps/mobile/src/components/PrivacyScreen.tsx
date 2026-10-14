import { useState } from "react";
import { Platform, Share, Text } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { api, demoMode } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { Body, Button, Card, Display, Field, Screen } from "./ui";

export function PrivacyScreen() {
  const { token, profile, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? "");
  const [exportData, setExportData] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState("");
  const rename = useMutation({ mutationFn: () => api.updateProfileDetails(name, token, profile?.role), onSuccess: async () => { await refreshProfile(); setMessage("Name updated."); } });
  const download = useMutation({ mutationFn: () => api.exportMyData(token, profile?.role), onSuccess: data => setExportData(JSON.stringify(data, null, 2)) });
  const deletion = useMutation({ mutationFn: (cancel: boolean) => api.requestDeletion(cancel, token), onSuccess: async data => { await refreshProfile(); setConfirmDelete(false); setMessage(`Deletion request ${data.status}.`); } });
  const deliver = async () => {
    if (!exportData) return;
    if (Platform.OS !== "web") { await Share.share({ title: "GiveHub personal data", message: exportData }); return; }
    const url = URL.createObjectURL(new Blob([exportData], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "givehub-personal-data.json";
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  };
  const error = rename.error ?? download.error ?? deletion.error;
  return <Screen>
    <Display>Your account and data</Display>
    <Body className="mt-3 mb-6">GiveHub stores your profile, hosted applications, signed agreements and participation records. External host forms keep their answers outside GiveHub.</Body>
    <Card className="mb-5"><Field label="Your display name" value={name} onChangeText={setName} /><Button label="Update name" disabled={name.trim().length < 2} loading={rename.isPending} onPress={() => rename.mutate()} /><Body className="mt-3">Contact email: {profile?.email}. Change your sign-in email through the account provider so it remains verified.</Body></Card>
    <Card className="mb-5"><Text className="font-display text-xl text-foreground dark:text-dark-foreground">Access your records</Text><Body className="mt-2 mb-4">Prepare a copy of your own profile, applications, consent records, saves, reports and activity. Your export contains personal information.</Body><Button label={exportData ? "Download or share my data" : "Prepare my data export"} loading={download.isPending} onPress={() => exportData ? void deliver() : download.mutate()} /></Card>
    <Card><Text className="font-display text-xl text-foreground dark:text-dark-foreground">Close your account</Text><Body className="mt-2 mb-4">A reviewer completes removal of your personal GiveHub records and account. Organizer listings are unpublished. You can cancel while the request is pending. Withdrawing an application alone does not delete its data.</Body>
      {demoMode ? <Body>This is a session-only demo. Reload to discard session changes; it does not create a real account.</Body> : profile?.deletion_requested_at ? <><Body>Your request is pending.</Body><Button className="mt-3" variant="secondary" label="Cancel deletion request" loading={deletion.isPending} onPress={() => deletion.mutate(true)} /></> : confirmDelete ? <><Button variant="danger" label="Confirm request to close my account" loading={deletion.isPending} onPress={() => deletion.mutate(false)} /><Button className="mt-3" variant="secondary" label="Keep my account" onPress={() => setConfirmDelete(false)} /></> : <Button variant="secondary" label="Request account removal" onPress={() => setConfirmDelete(true)} />}
    </Card>
    {error ? <Text accessibilityRole="alert" className="mt-4 text-destructive dark:text-dark-destructive">{error.message}</Text> : null}
    {message ? <Body className="mt-4">{message}</Body> : null}
  </Screen>;
}
