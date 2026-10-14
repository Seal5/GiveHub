import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Application, ApplicationStatus } from "@/lib/types";
import { Body, Button, Card } from "./ui";

export function ApplicantWorkspace({ applications, token }: { applications: Application[]; token: string | null }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = applications.find(a => a.id === selectedId) ?? applications[0];
  const client = useQueryClient();
  useEffect(() => { if (!applications.some(a => a.id === selectedId)) setSelectedId(applications[0]?.id ?? null); }, [applications, selectedId]);
  const decision = useMutation({ mutationFn: (status: ApplicationStatus) => api.transition(selected!.id, status, selected!.version, token), onSuccess: () => { void client.invalidateQueries({ queryKey: ["pipeline"] }); void client.invalidateQueries({ queryKey: ["organiser"] }); } });
  return <View className="flex-row items-start gap-5">
    <Card className="flex-1">
      <View className="flex-row border-b border-border pb-3 dark:border-dark-border">
        <Text className="flex-1 font-strong text-sm text-foreground dark:text-dark-foreground">Applicant</Text>
        <Text className="w-36 font-strong text-sm text-foreground dark:text-dark-foreground">Availability</Text>
        <Text className="w-28 font-strong text-sm text-foreground dark:text-dark-foreground">Stage</Text>
      </View>
      {applications.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Review ${item.volunteer_name}`} accessibilityState={{ selected: item.id === selected?.id }} onPress={() => { setSelectedId(item.id); decision.reset(); }} className={`min-h-16 flex-row items-center border-b border-border py-4 dark:border-dark-border ${item.id === selected?.id ? "bg-secondary dark:bg-dark-secondary" : ""}`}>
        <View className="flex-1 px-2"><Text className="font-strong text-sm text-foreground dark:text-dark-foreground">{item.volunteer_name}</Text><Body>{item.volunteer_email}</Body></View>
        <Text className="w-36 pr-3 font-sans text-xs text-muted-foreground dark:text-dark-muted-foreground">{item.availability}</Text>
        <Text className="w-28 font-sans text-xs text-primary dark:text-dark-primary">{item.status.replace("_", " ")}</Text>
      </Pressable>)}
      {!applications.length ? <Body className="mt-4">No applicants match these filters.</Body> : null}
    </Card>
    <Card className="w-96">
      {selected ? <>
        <Text className="font-display text-2xl text-foreground dark:text-dark-foreground">{selected.volunteer_name}</Text><Body>{selected.volunteer_email}</Body>
        <Text className="mt-5 font-strong text-sm text-foreground dark:text-dark-foreground">Application</Text><Body className="mt-2">{selected.note}</Body>
        <Text className="mt-5 font-strong text-sm text-foreground dark:text-dark-foreground">Experience</Text><Body className="mt-2">{selected.experience || "No experience details supplied."}</Body>
        <Text className="mt-5 font-strong text-sm text-foreground dark:text-dark-foreground">Availability</Text><Body className="mt-2">{selected.availability}</Body>
        <Body className="mt-5">Stage: {selected.status.replace("_", " ")}</Body>
        {["received", "under_review", "waitlisted"].includes(selected.status) ? <>
          <Button className="mt-4" label="Confirm volunteer" loading={decision.isPending} onPress={() => decision.mutate("confirmed")} />
          {selected.status !== "waitlisted" ? <Button className="mt-3" variant="secondary" label="Move to waitlist" disabled={decision.isPending} onPress={() => decision.mutate("waitlisted")} /> : null}
          <Button className="mt-3" variant="secondary" label="Decline application" disabled={decision.isPending} onPress={() => decision.mutate("declined")} />
        </> : <Body className="mt-3">{selected.next_step}</Body>}
        {decision.error ? <Text accessibilityRole="alert" className="mt-3 text-destructive dark:text-dark-destructive">{decision.error.message}</Text> : null}
      </> : <Body>Select an applicant to review their details.</Body>}
    </Card>
  </View>;
}
