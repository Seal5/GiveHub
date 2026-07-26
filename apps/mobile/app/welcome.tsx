import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

function RoleChoice({ organiser = false }: { organiser?: boolean }) {
  const role = organiser ? "organiser" : "volunteer";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        organiser ? "I organise volunteer work" : "I want to volunteer"
      }
      onPress={() => router.push(`/auth/${role}`)}
      className={`mb-3 min-h-[72px] flex-row items-center rounded-card px-5 active:opacity-80 ${
        organiser ? "border border-white/20 bg-white/10" : "bg-primary"
      }`}
    >
      <View className="flex-1 pr-4">
        <Text className="font-strong text-sm text-white">
          {organiser ? "I organise volunteer work" : "I want to volunteer"}
        </Text>
        <Text
          className={`mt-1 font-sans text-xs ${organiser ? "text-white/65" : "text-white/80"}`}
        >
          {organiser
            ? "Post events and coordinate your people"
            : "Discover causes worth your time"}
        </Text>
      </View>
      <Ionicons name="arrow-forward" size={20} color="#F8FFF8" />
    </Pressable>
  );
}

export default function WelcomeScreen() {
  return (
    <SafeAreaView className="flex-1 overflow-hidden bg-[#102219]">
      <StatusBar style="light" />
      <View
        pointerEvents="none"
        className="absolute -right-20 top-28 h-72 w-72 rounded-full border border-primary/25"
      />
      <View
        pointerEvents="none"
        className="absolute -right-5 top-44 h-48 w-48 rounded-full border border-primary/15"
      />
      <View
        pointerEvents="none"
        className="absolute -bottom-48 -left-24 h-96 w-96 rounded-full bg-primary/10"
      />

      <View className="flex-1 px-6 pb-8 pt-5">
        <View className="flex-row items-center gap-3">
          <View className="h-8 w-8 items-center justify-center rounded-xl bg-primary">
            <Ionicons name="leaf" size={17} color="#F8FFF8" />
          </View>
          <Text className="font-display text-xl text-white">GiveHub</Text>
        </View>

        <View className="mt-auto">
          <View className="self-start rounded-full bg-primary/15 px-3 py-2">
            <Text className="font-strong text-[10px] uppercase tracking-[1.2px] text-primary">
              Make local change tangible
            </Text>
          </View>
          <Text className="mt-5 font-display text-[45px] leading-[45px] tracking-[-2.2px] text-white">
            A better way{`\n`}to show up.
          </Text>
          <Text className="mt-5 max-w-[310px] font-sans text-sm leading-6 text-white/70">
            Find good work nearby, or bring your volunteer community together
            with one clear home for every event.
          </Text>

          <View className="mt-8">
            <RoleChoice />
            <RoleChoice organiser />
          </View>

          <View className="mt-3 flex-row items-center justify-center border-t border-white/10 pt-5">
            <Text className="font-sans text-xs text-white/55">
              Already have an account?
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: "/auth/[role]",
                  params: { role: "volunteer", mode: "signin" },
                })
              }
              className="min-h-11 justify-center px-2"
            >
              <Text className="font-strong text-xs text-primary">Sign in</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
