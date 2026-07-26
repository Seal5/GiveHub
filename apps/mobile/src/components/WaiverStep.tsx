import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Waiver } from "@/lib/types";
import type { WaiverDraft } from "@/lib/waiver";
import { Body, Card, Field, useThemeColours } from "@/components/ui";

function Checkbox({ checked, label, onToggle }: { checked: boolean; label: string; onToggle: () => void }) {
  const colours = useThemeColours();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={onToggle}
      className="min-h-11 flex-row items-center gap-3 py-2 active:opacity-70"
    >
      <View className={`h-6 w-6 items-center justify-center rounded-md border-2 ${checked ? "border-primary bg-primary dark:border-dark-primary dark:bg-dark-primary" : "border-border dark:border-dark-border"}`}>
        {checked ? <Ionicons name="checkmark" size={16} color={colours.primaryForeground} /> : null}
      </View>
      <Text className="flex-1 font-sans text-sm leading-5 text-foreground dark:text-dark-foreground">{label}</Text>
    </Pressable>
  );
}

type Props = { waiver: Waiver; draft: WaiverDraft; onChange: (draft: WaiverDraft) => void };

export function WaiverStep({ waiver, draft, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const colours = useThemeColours();
  const patch = (changes: Partial<WaiverDraft>) => onChange({ ...draft, ...changes });

  return (
    <Card className="mb-5">
      <View className="mb-3 flex-row items-center gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-xl bg-secondary dark:bg-dark-secondary">
          <Ionicons name="document-text-outline" size={18} color={colours.primary} />
        </View>
        <View className="flex-1">
          <Text className="font-strong text-sm text-foreground dark:text-dark-foreground">{waiver.title}</Text>
          <Text className="font-sans text-xs text-muted-foreground dark:text-dark-muted-foreground">Version {waiver.version}</Text>
        </View>
      </View>

      <ScrollView
        nestedScrollEnabled
        style={{ maxHeight: expanded ? 420 : 168 }}
        className="rounded-card border border-border bg-background p-4 dark:border-dark-border dark:bg-dark-background"
      >
        <Text className="font-sans text-sm leading-6 text-foreground dark:text-dark-foreground">{waiver.body}</Text>
      </ScrollView>
      <Pressable accessibilityRole="button" onPress={() => setExpanded((value) => !value)} className="min-h-11 justify-center">
        <Text className="font-strong text-sm text-primary dark:text-dark-primary">{expanded ? "Show less" : "Read the full agreement"}</Text>
      </Pressable>

      <View className="mt-2 border-t border-border pt-3 dark:border-dark-border">
        <Checkbox
          checked={draft.agreed}
          label="I have read and agree to this volunteer agreement."
          onToggle={() => patch({ agreed: !draft.agreed })}
        />
        <Checkbox
          checked={draft.isMinor}
          label="I am under 18, so my parent or guardian is consenting for me."
          onToggle={() => patch({ isMinor: !draft.isMinor })}
        />
      </View>

      <View className="mt-4">
        <Field
          label="Type your full name as signature"
          placeholder="Your full name"
          autoCapitalize="words"
          value={draft.signedName}
          onChangeText={(value) => patch({ signedName: value })}
        />
        {draft.isMinor ? (
          <>
            <Body className="mb-4">Your parent or guardian will receive a copy of this agreement by email.</Body>
            <Field
              label="Parent or guardian name"
              placeholder="Their full name"
              autoCapitalize="words"
              value={draft.guardianName}
              onChangeText={(value) => patch({ guardianName: value })}
            />
            <Field
              label="Parent or guardian email"
              placeholder="them@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={draft.guardianEmail}
              onChangeText={(value) => patch({ guardianEmail: value })}
            />
            <Field
              label="Relationship to you (optional)"
              placeholder="e.g. Parent"
              value={draft.guardianRelationship}
              onChangeText={(value) => patch({ guardianRelationship: value })}
            />
          </>
        ) : null}
      </View>
    </Card>
  );
}
