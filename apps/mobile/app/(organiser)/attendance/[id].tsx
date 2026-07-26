import { Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AttendanceRow, AttendanceStatus } from "@/lib/types";
import { useAuth } from "@/providers/AuthProvider";
import { Body, Card, Display, EmptyState, ErrorState, Eyebrow, IconButton, LoadingState, Screen, useThemeColours } from "@/components/ui";

const MARKS: { status: AttendanceStatus; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { status: "attended", label: "Here", icon: "checkmark-circle" },
  { status: "no_show", label: "No show", icon: "close-circle" },
  { status: "excused", label: "Excused", icon: "remove-circle" },
];

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View className="flex-1">
      <Text className="font-display text-2xl text-primary dark:text-dark-primary">{value}</Text>
      <Body>{label}</Body>
    </View>
  );
}

function VolunteerRow({
  row,
  onMark,
  pending,
}: {
  row: AttendanceRow;
  onMark: (status: AttendanceStatus) => void;
  pending: boolean;
}) {
  const colours = useThemeColours();
  return (
    <Card className="mb-3">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="font-strong text-sm text-foreground dark:text-dark-foreground">{row.volunteer_name}</Text>
          <Body className="mt-0.5">{row.volunteer_email}</Body>
        </View>
        {row.status === "attended" ? (
          <View className="rounded-full bg-secondary px-3 py-1 dark:bg-dark-secondary">
            <Text className="font-strong text-[10px] uppercase text-primary dark:text-dark-primary">{row.hours}h logged</Text>
          </View>
        ) : null}
      </View>
      <View className="mt-4 flex-row gap-2">
        {MARKS.map((mark) => {
          const selected = row.status === mark.status;
          return (
            <Pressable
              key={mark.status}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: pending }}
              accessibilityLabel={`Mark ${row.volunteer_name} as ${mark.label}`}
              disabled={pending}
              onPress={() => onMark(mark.status)}
              className={`min-h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-card border px-2 active:opacity-70 disabled:opacity-50 ${selected ? "border-primary bg-secondary dark:border-dark-primary dark:bg-dark-secondary" : "border-border bg-card dark:border-dark-border dark:bg-dark-card"}`}
            >
              <Ionicons name={mark.icon} size={16} color={selected ? colours.primary : colours.mutedForeground} />
              <Text className={`font-strong text-xs ${selected ? "text-primary dark:text-dark-primary" : "text-muted-foreground dark:text-dark-muted-foreground"}`}>{mark.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

export default function AttendanceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const client = useQueryClient();
  const sheet = useQuery({ queryKey: ["attendance", id], queryFn: () => api.attendanceSheet(id, token), enabled: Boolean(id) });
  const mark = useMutation({
    mutationFn: ({ applicationId, status }: { applicationId: string; status: AttendanceStatus }) =>
      api.recordAttendance(applicationId, { status }, token),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["attendance", id] });
      client.invalidateQueries({ queryKey: ["impact"] });
    },
  });

  if (sheet.isLoading) return <Screen scroll={false}><LoadingState /></Screen>;
  if (sheet.isError) return <Screen><ErrorState error={sheet.error} onRetry={() => sheet.refetch()} /></Screen>;

  const data = sheet.data;

  return (
    <Screen refreshing={sheet.isRefetching} onRefresh={() => sheet.refetch()}>
      <IconButton icon="arrow-back" label="Back" className="mb-6" onPress={() => router.back()} />
      <Eyebrow>Attendance</Eyebrow>
      <Display className="text-[30px] leading-8">{data?.opportunity_title}</Display>
      <Body className="mb-6 mt-3">
        Mark people off on the day. Marking someone here credits the hours to their volunteer record,
        so only mark people who actually turned up.
      </Body>

      <Card className="mb-6">
        <View className="flex-row justify-between">
          <Stat value={String(data?.attended ?? 0)} label="Attended" />
          <Stat value={String(data?.expected ?? 0)} label="Not marked" />
          <Stat value={String(data?.no_show ?? 0)} label="No show" />
          <Stat value={`${data?.total_hours ?? 0}h`} label="Hours given" />
        </View>
      </Card>

      {mark.error ? <Text accessibilityRole="alert" className="mb-3 font-sans text-sm text-destructive dark:text-dark-destructive">{mark.error.message}</Text> : null}

      {data?.rows.length ? (
        data.rows.map((row) => (
          <VolunteerRow
            key={row.application_id}
            row={row}
            pending={mark.isPending}
            onMark={(status) => mark.mutate({ applicationId: row.application_id, status })}
          />
        ))
      ) : (
        <EmptyState title="Nobody is confirmed yet" body="Confirm volunteers in the pipeline and they will appear here to mark off." />
      )}
    </Screen>
  );
}
