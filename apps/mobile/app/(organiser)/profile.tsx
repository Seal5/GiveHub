import { router } from "expo-router";
import { Text } from "react-native";
import { useAuth } from "@/providers/AuthProvider";
import { Body, Button, Card, Display, Eyebrow, Screen } from "@/components/ui";

function DetailCard({ title, value, className = "" }: { title: string; value: string; className?: string }) {
  return (
    <Card className={className}>
      <Text className="font-medium text-sm text-foreground dark:text-dark-foreground">{title}</Text>
      <Body className="mt-1">{value}</Body>
    </Card>
  );
}

export default function OrganiserProfile() {
  const { profile, signOut } = useAuth();
  return (
    <Screen>
      <Eyebrow>Organiser profile</Eyebrow>
      <Display>{profile?.organisation_name ?? "Your organisation"}</Display>
      <Body className="mb-7 mt-3">Your organiser account is approved for the beta. Future manual verification can be enabled without changing the profile model.</Body>
      <DetailCard className="mb-5" title="Contact email" value={profile?.email ?? "—"} />
      <DetailCard className="mb-5" title="Publishing status" value="Approved · opportunities can go live" />
      <Button label="Edit volunteer agreement" variant="secondary" className="mb-3" onPress={() => router.push("/(organiser)/waiver")} />
      <Button label="Sign out" variant="secondary" onPress={async () => { await signOut(); router.replace("/welcome"); }} />
    </Screen>
  );
}
