import { router } from "expo-router";
import { Text } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import { Body, Button, Card, Display, Eyebrow, Screen } from "@/components/ui";
import { api } from "@/lib/api";

function DetailCard({ title, value, className = "" }: { title: string; value: string; className?: string }) {
  return (
    <Card className={className}>
      <Text className="font-medium text-sm text-foreground dark:text-dark-foreground">{title}</Text>
      <Body className="mt-1">{value}</Body>
    </Card>
  );
}

export default function OrganiserProfile() {
  const { profile, signOut, token } = useAuth();
  const client = useQueryClient();
  const notifications = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => api.notificationPreferences(token),
  });
  const updateNotifications = useMutation({
    mutationFn: (enabled: boolean) => api.updateNotificationPreferences(enabled, token),
    onSuccess: () => client.invalidateQueries({ queryKey: ["notification-preferences"] }),
  });
  return (
    <Screen>
      <Eyebrow>Organiser profile</Eyebrow>
      <Display>{profile?.organisation_name ?? "Your organisation"}</Display>
      <Body className="mb-7 mt-3">Your organiser account is approved for the beta. Future manual verification can be enabled without changing the profile model.</Body>
      <DetailCard className="mb-5" title="Contact email" value={profile?.email ?? "—"} />
      <DetailCard className="mb-5" title="Publishing status" value="Approved · opportunities can go live" />
      <Card className="mb-5">
        <Text className="font-medium text-sm text-foreground dark:text-dark-foreground">New application emails</Text>
        <Body className="mb-3 mt-1">Choose whether GiveHub emails your organisation whenever a new internal application arrives.</Body>
        <Button
          label={notifications.data?.notify_new_applications ? "Emails on" : "Emails off"}
          variant="secondary"
          loading={notifications.isLoading || updateNotifications.isPending}
          onPress={() => updateNotifications.mutate(!notifications.data?.notify_new_applications)}
        />
      </Card>
      <Button label="Edit volunteer agreement" variant="secondary" className="mb-3" onPress={() => router.push("/(organiser)/waiver")} />
      <Button label="Sign out" variant="secondary" onPress={async () => { await signOut(); router.replace("/welcome"); }} />
    </Screen>
  );
}
