import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function Screen({ children, scroll = true, className = "" }: PropsWithChildren<{ scroll?: boolean; className?: string }>) {
  const content = <View className={`flex-1 px-5 pb-8 ${className}`}>{children}</View>;
  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-paper dark:bg-night">
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="grow">{content}</ScrollView> : content}
    </SafeAreaView>
  );
}

export function Eyebrow({ children }: PropsWithChildren) {
  return <Text className="mb-2 font-mono text-xs uppercase tracking-[2px] text-moss dark:text-fern">{children}</Text>;
}

export function Display({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return <Text accessibilityRole="header" className={`font-display text-[38px] leading-[42px] text-ink dark:text-paper ${className}`}>{children}</Text>;
}

export function Heading({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return <Text accessibilityRole="header" className={`font-display text-2xl leading-8 text-ink dark:text-paper ${className}`}>{children}</Text>;
}

export function Body({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return <Text className={`font-sans text-base leading-6 text-ink/70 dark:text-paper/70 ${className}`}>{children}</Text>;
}

export function Card({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return <View className={`rounded-card border border-ink/10 bg-white p-5 dark:border-paper/10 dark:bg-white/5 ${className}`}>{children}</View>;
}

type ButtonProps = PressableProps & { label: string; variant?: "primary" | "secondary" | "danger"; icon?: ReactNode; loading?: boolean };
export function Button({ label, variant = "primary", icon, loading, disabled, className = "", ...props }: ButtonProps & { className?: string }) {
  const colours = variant === "primary" ? "bg-moss" : variant === "danger" ? "bg-clay" : "border border-moss bg-transparent";
  const text = variant === "secondary" ? "text-moss dark:text-fern" : "text-white";
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      className={`min-h-14 flex-row items-center justify-center gap-2 rounded-2xl px-5 active:opacity-80 disabled:opacity-50 ${colours} ${className}`}
      {...props}
    >
      {loading ? <ActivityIndicator color={variant === "secondary" ? "#2D945D" : "white"} /> : icon}
      <Text className={`font-medium text-base ${text}`}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  return (
    <View className="mb-4">
      <Text className="mb-2 font-mono text-xs uppercase tracking-[1.5px] text-ink/65 dark:text-paper/65">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#829087"
        className="min-h-14 rounded-2xl border border-ink/10 bg-white px-4 font-sans text-base text-ink dark:border-paper/10 dark:bg-white/5 dark:text-paper"
        {...props}
      />
      {error ? <Text className="mt-1 font-sans text-sm text-clay">{error}</Text> : null}
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`mr-2 min-h-11 justify-center rounded-full border px-4 ${selected ? "border-moss bg-moss" : "border-ink/15 bg-transparent dark:border-paper/20"}`}
    >
      <Text className={`font-medium text-sm ${selected ? "text-white" : "text-ink dark:text-paper"}`}>{label}</Text>
    </Pressable>
  );
}

export function LoadingState({ label = "Loading GiveHub…" }: { label?: string }) {
  return <View className="flex-1 items-center justify-center gap-3"><ActivityIndicator color="#2D945D" /><Body>{label}</Body></View>;
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return <Card className="items-center py-10"><Heading className="text-center">{title}</Heading><Body className="mt-2 text-center">{body}</Body></Card>;
}

