import { router } from "expo-router";
import { Body, Button, Display, Eyebrow, Screen } from "@/components/ui";

export default function VerifyEmailScreen() {
  return <Screen><Eyebrow>One last step</Eyebrow><Display>Verify your email.</Display><Body className="mb-8 mt-4">Open the link we sent to finish creating your GiveHub account. You can return here once it is verified.</Body><Button label="Return to sign in" onPress={() => router.replace("/welcome")} /></Screen>;
}
