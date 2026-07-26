import { router } from "expo-router";
import { Text } from "react-native";
import { useAuth } from "@/providers/AuthProvider";
import { Body, Button, Card, Display, Eyebrow, Screen } from "@/components/ui";

export default function OrganiserProfile() {
  const { profile, signOut } = useAuth();
  return <Screen><Eyebrow>Organiser profile</Eyebrow><Display>{profile?.organisation_name}</Display><Body className="mb-7 mt-3">Your organiser account is approved for the beta. Future manual verification can be enabled without changing the profile model.</Body><Card className="mb-5"><Text className="font-medium text-ink dark:text-paper">Contact email</Text><Body className="mt-1">{profile?.email}</Body></Card><Card className="mb-7"><Text className="font-medium text-ink dark:text-paper">Publishing status</Text><Body className="mt-1">Approved · opportunities can go live</Body></Card><Button label="Sign out" variant="secondary" onPress={async () => { await signOut(); router.replace("/welcome"); }} /></Screen>;
}
