import { ImageBackground, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

const hero = "https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=1600&q=90";

function RoleChoice({ organiser = false }: { organiser?: boolean }) {
  const role = organiser ? "organiser" : "volunteer";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={organiser ? "I organise volunteer work" : "I want to volunteer"}
      onPress={() => router.push(`/auth/${role}`)}
      className="mb-3 min-h-20 flex-row items-center rounded-card bg-paper px-5 active:opacity-90"
    >
      <View className="flex-1">
        <Text className="font-display text-xl text-ink">{organiser ? "I organise volunteer work" : "I want to volunteer"}</Text>
        <Text className="mt-1 font-sans text-sm text-ink/60">{organiser ? "Post events and coordinate your people" : "Discover causes worth your time"}</Text>
      </View>
      <Ionicons name="arrow-forward" size={22} color="#2D945D" />
    </Pressable>
  );
}

export default function WelcomeScreen() {
  return (
    <ImageBackground source={{ uri: hero }} className="flex-1" resizeMode="cover">
      <LinearGradient colors={["rgba(6,20,12,.28)", "rgba(6,20,12,.97)"]} className="absolute inset-0" />
      <SafeAreaView className="flex-1 justify-between px-5 pb-8 pt-4">
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-moss"><Ionicons name="leaf" size={20} color="white" /></View>
          <View><Text className="font-display text-2xl text-paper">GiveHub</Text><Text className="font-mono text-[10px] uppercase tracking-[2px] text-fern">Make local change tangible</Text></View>
        </View>
        <View>
          <Text className="font-display text-[48px] leading-[52px] text-paper">A better way{`\n`}to show up.</Text>
          <Text className="mb-8 mt-4 max-w-sm font-sans text-lg leading-7 text-paper/75">Find good work nearby, or bring your volunteer community together with one clear home for every event.</Text>
          <RoleChoice />
          <RoleChoice organiser />
          <Text className="mt-4 text-center font-sans text-sm text-paper/60">Already have an account? Choose your role above, then sign in.</Text>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

