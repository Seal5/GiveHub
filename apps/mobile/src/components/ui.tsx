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
import { Ionicons } from "@expo/vector-icons";

export function BrandMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-8 w-8 items-center justify-center rounded-xl bg-primary dark:bg-dark-primary">
        <Ionicons name="leaf" size={17} color="#F8FFF8" />
      </View>
      <Text className={`font-display text-xl ${inverse ? "text-white" : "text-foreground dark:text-dark-foreground"}`}>GiveHub</Text>
    </View>
  );
}

export function Screen({ children, scroll = true, className = "" }: PropsWithChildren<{ scroll?: boolean; className?: string }>) {
  const content = <View className={`flex-1 px-5 pb-8 pt-3 ${className}`}>{children}</View>;
  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background dark:bg-dark-background">
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerClassName="grow">{content}</ScrollView> : content}
    </SafeAreaView>
  );
}

export function Eyebrow({ children }: PropsWithChildren) {
  return <Text className="mb-2 font-strong text-xs uppercase tracking-[1.7px] text-primary dark:text-dark-primary">{children}</Text>;
}

export function Display({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return <Text accessibilityRole="header" className={`font-display text-[34px] leading-[37px] tracking-[-1.2px] text-foreground dark:text-dark-foreground ${className}`}>{children}</Text>;
}

export function Heading({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return <Text accessibilityRole="header" className={`font-display text-2xl leading-8 tracking-[-0.7px] text-foreground dark:text-dark-foreground ${className}`}>{children}</Text>;
}

export function Body({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return <Text className={`font-sans text-sm leading-5 text-muted-foreground dark:text-dark-muted-foreground ${className}`}>{children}</Text>;
}

export function Card({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return <View className={`rounded-card border border-border bg-card p-5 dark:border-dark-border dark:bg-dark-card ${className}`}>{children}</View>;
}

type ButtonProps = PressableProps & { label: string; variant?: "primary" | "secondary" | "danger"; icon?: ReactNode; loading?: boolean };
export function Button({ label, variant = "primary", icon, loading, disabled, className = "", ...props }: ButtonProps & { className?: string }) {
  const colours = variant === "primary" ? "bg-primary dark:bg-dark-primary" : variant === "danger" ? "bg-destructive dark:bg-dark-destructive" : "border border-primary bg-transparent dark:border-dark-primary";
  const text = variant === "secondary" ? "text-primary dark:text-dark-primary" : "text-primary-foreground dark:text-dark-primary-foreground";
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      className={`min-h-14 flex-row items-center justify-center gap-2 rounded-card px-5 active:opacity-80 disabled:opacity-50 ${colours} ${className}`}
      {...props}
    >
      {loading ? <ActivityIndicator color={variant === "secondary" ? "#2A8D58" : "#F8FFF8"} /> : icon}
      <Text className={`font-strong text-sm ${text}`}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  return (
    <View className="mb-4">
      <Text className="mb-2 font-strong text-xs uppercase tracking-[1.3px] text-muted-foreground dark:text-dark-muted-foreground">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#657166"
        className="min-h-14 rounded-card border border-border bg-card px-4 font-sans text-sm text-foreground dark:border-dark-border dark:bg-dark-card dark:text-dark-foreground"
        {...props}
      />
      {error ? <Text className="mt-1 font-sans text-sm text-destructive dark:text-dark-destructive">{error}</Text> : null}
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`mr-2 min-h-11 justify-center rounded-full border px-4 ${selected ? "border-primary bg-secondary dark:border-dark-primary dark:bg-dark-secondary" : "border-border bg-card dark:border-dark-border dark:bg-dark-card"}`}
    >
      <Text className={`font-medium text-sm ${selected ? "text-secondary-foreground dark:text-dark-secondary-foreground" : "text-foreground dark:text-dark-foreground"}`}>{label}</Text>
    </Pressable>
  );
}

export function LoadingState({ label = "Loading GiveHub…" }: { label?: string }) {
  return <View className="flex-1 items-center justify-center gap-3"><ActivityIndicator color="#2A8D58" /><Body>{label}</Body></View>;
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return <Card className="items-center py-10"><Heading className="text-center">{title}</Heading><Body className="mt-2 text-center">{body}</Body></Card>;
}

