import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";

/**
 * Icon and native component colours cannot use Tailwind classes, so the palette is
 * mirrored here. Keep these values in sync with tailwind.config.js.
 */
export type ThemeColours = {
  primary: string;
  primaryForeground: string;
  foreground: string;
  mutedForeground: string;
  border: string;
  card: string;
  background: string;
  destructive: string;
  accent: string;
};

const palette: Record<"light" | "dark", ThemeColours> = {
  light: {
    primary: "#2A8D58",
    primaryForeground: "#F8FFF8",
    foreground: "#17221A",
    mutedForeground: "#657166",
    border: "#E8E8E2",
    card: "#FFFEFA",
    background: "#F6F6F0",
    destructive: "#E03030",
    accent: "#BB704B",
  },
  dark: {
    primary: "#8BD19F",
    primaryForeground: "#0C1810",
    foreground: "#EDF4EC",
    mutedForeground: "#9BAC9F",
    border: "#2B372F",
    card: "#17241C",
    background: "#101A14",
    destructive: "#FF5E6A",
    accent: "#E3A37E",
  },
};

/** Resolves palette values against the user's saved theme, not just the OS setting. */
export function useThemeColours(): ThemeColours {
  const { colorScheme } = useColorScheme();
  return colorScheme === "dark" ? palette.dark : palette.light;
}

export function BrandMark({ inverse = false }: { inverse?: boolean }) {
  const colours = useThemeColours();
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-8 w-8 items-center justify-center rounded-xl bg-primary dark:bg-dark-primary">
        <Ionicons name="leaf" size={17} color={inverse ? "#F8FFF8" : colours.primaryForeground} />
      </View>
      <Text className={`font-display text-xl ${inverse ? "text-white" : "text-foreground dark:text-dark-foreground"}`}>GiveHub</Text>
    </View>
  );
}

/** Circular icon button used for back, close, and overflow actions. */
export function IconButton({ icon, label, onPress, className = "", tone = "card" }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; className?: string; tone?: "card" | "overlay" }) {
  const colours = useThemeColours();
  const surface = tone === "overlay" ? "bg-background/95 dark:bg-dark-background/95" : "border border-border bg-card dark:border-dark-border dark:bg-dark-card";
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} className={`h-11 w-11 items-center justify-center rounded-full active:opacity-80 ${surface} ${className}`}>
      <Ionicons name={icon} size={20} color={colours.primary} />
    </Pressable>
  );
}

type ScreenProps = { scroll?: boolean; className?: string; refreshing?: boolean; onRefresh?: () => void };
export function Screen({ children, scroll = true, className = "", refreshing, onRefresh }: PropsWithChildren<ScreenProps>) {
  const colours = useThemeColours();
  const content = <View className={`flex-1 px-5 pb-8 pt-3 ${className}`}>{children}</View>;
  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background dark:bg-dark-background">
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="grow"
          refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colours.primary} colors={[colours.primary]} /> : undefined}
        >
          {content}
        </ScrollView>
      ) : content}
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
  const theme = useThemeColours();
  const colours = variant === "primary" ? "bg-primary dark:bg-dark-primary" : variant === "danger" ? "bg-destructive dark:bg-dark-destructive" : "border border-primary bg-transparent dark:border-dark-primary";
  const text = variant === "secondary" ? "text-primary dark:text-dark-primary" : "text-primary-foreground dark:text-dark-primary-foreground";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }}
      disabled={disabled || loading}
      className={`min-h-14 flex-row items-center justify-center gap-2 rounded-card px-5 active:opacity-80 disabled:opacity-50 ${colours} ${className}`}
      {...props}
    >
      {loading ? <ActivityIndicator color={variant === "secondary" ? theme.primary : theme.primaryForeground} /> : icon}
      <Text className={`font-strong text-sm ${text}`}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  const colours = useThemeColours();
  return (
    <View className="mb-4">
      <Text className="mb-2 font-strong text-xs uppercase tracking-[1.3px] text-muted-foreground dark:text-dark-muted-foreground">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colours.mutedForeground}
        className={`min-h-14 rounded-card border bg-card px-4 py-3 font-sans text-sm text-foreground dark:bg-dark-card dark:text-dark-foreground ${error ? "border-destructive dark:border-dark-destructive" : "border-border dark:border-dark-border"}`}
        {...props}
      />
      {error ? <Text accessibilityRole="alert" className="mt-1 font-sans text-sm text-destructive dark:text-dark-destructive">{error}</Text> : null}
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
  const colours = useThemeColours();
  return <View accessibilityRole="progressbar" accessibilityLabel={label} className="flex-1 items-center justify-center gap-3"><ActivityIndicator color={colours.primary} /><Body>{label}</Body></View>;
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return <Card className="items-center py-10"><Heading className="text-center">{title}</Heading><Body className="mt-2 text-center">{body}</Body></Card>;
}

/**
 * Distinguishes a failed request from genuinely empty data. Without this a dropped
 * connection renders as "nothing here", which reads as an empty account.
 */
export function ErrorState({ error, onRetry, title = "That didn’t load" }: { error?: Error | null; onRetry?: () => void; title?: string }) {
  const colours = useThemeColours();
  return (
    <Card className="items-center py-8">
      <View className="mb-3 h-11 w-11 items-center justify-center rounded-full bg-secondary dark:bg-dark-secondary">
        <Ionicons name="cloud-offline-outline" size={21} color={colours.destructive} />
      </View>
      <Heading className="text-center">{title}</Heading>
      <Body className="mt-2 text-center">{error?.message ?? "Check your connection and try again."}</Body>
      {onRetry ? <Button label="Try again" variant="secondary" className="mt-5 self-stretch" onPress={onRetry} /> : null}
    </Card>
  );
}

