import { useState } from "react";
import { Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, demoMode } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { Body, Button, Card, Chip, Display, ErrorState, Field, Screen } from "./ui";

export function GovernanceScreen() {
  const { token, profile } = useAuth();
  const client = useQueryClient();
  const [note, setNote] = useState("");
  const [host, setHost] = useState("volunteersuccess.com");
  const [permission, setPermission] = useState("");
  const [selectedDeletion, setSelectedDeletion] = useState<string | null>(null);
  const enabled = !demoMode && Boolean(profile?.can_review_sources);
  const organisations = useQuery({ queryKey: ["review-organisations"], queryFn: () => api.reviewOrganisations(token), enabled });
  const policies = useQuery({ queryKey: ["source-policies"], queryFn: () => api.sourcePolicies(token), enabled });
  const deletions = useQuery({ queryKey: ["deletion-requests"], queryFn: () => api.deletionRequests(token), enabled });
  const review = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => api.reviewOrganisation(id, status, note, token), onSuccess: () => { setNote(""); void client.invalidateQueries({ queryKey: ["review-organisations"] }); } });
  const source = useMutation({ mutationFn: (enabled: boolean) => api.updateSourcePolicy(host, enabled, permission, token), onSuccess: () => { setPermission(""); void client.invalidateQueries({ queryKey: ["source-policies"] }); } });
  const remove = useMutation({ mutationFn: (id: string) => api.completeDeletion(id, token), onSuccess: () => { setSelectedDeletion(null); void client.invalidateQueries({ queryKey: ["deletion-requests"] }); } });
  if (!profile?.can_review_sources && !demoMode) return <Screen><Display>Review access required.</Display><Body>These controls are available to configured GiveHub reviewers.</Body></Screen>;
  if (demoMode) return <Screen><Display>Reviewer workspace</Display><Body>The static demo does not approve real organizations, grant source permissions or delete stored accounts. Use the connected test environment to exercise these controls.</Body></Screen>;
  const error = organisations.error ?? policies.error ?? deletions.error ?? review.error ?? source.error ?? remove.error;
  return <Screen>
    <Display>Reviewer workspace</Display>
    <Body className="mt-3 mb-6">Record evidence before approving hosts or enabling source access. Reviewers cannot approve their own organization.</Body>
    {error ? <ErrorState error={error} /> : null}
    <Card className="mb-5">
      <Text className="font-display text-xl text-foreground dark:text-dark-foreground">Organizer approval</Text>
      <Field label="Review evidence and decision note" value={note} onChangeText={setNote} placeholder="Reference the host identity and authorization you checked" multiline />
      {organisations.data?.map(item => <View key={item.id} className="border-t border-border py-4 dark:border-dark-border">
        <Text className="font-strong text-base text-foreground dark:text-dark-foreground">{item.name} · {item.status}</Text>
        <Body>{item.contact_email}</Body><Body>{item.note}</Body>
        <View className="mt-3 flex-row gap-3"><View className="flex-1"><Button label={`Approve ${item.name}`} disabled={note.trim().length < 10 || review.isPending} onPress={() => review.mutate({ id: item.id, status: "approved" })} /></View><View className="flex-1"><Button variant="danger" label={`Reject ${item.name}`} disabled={note.trim().length < 10 || review.isPending} onPress={() => review.mutate({ id: item.id, status: "rejected" })} /></View></View>
      </View>)}
    </Card>
    <Card className="mb-5">
      <Text className="font-display text-xl text-foreground dark:text-dark-foreground">Approved sources</Text>
      <Body className="mt-2 mb-3">Production refresh skips sources without an enabled permission record. Only supported public sources can be enabled.</Body>
      <View className="flex-row flex-wrap gap-y-2">{["volunteersuccess.com", "www.volunteersuccess.com", "jamii.ca", "www.jamii.ca", "unitedwaygt.org", "www.unitedwaygt.org"].map(value => <Chip key={value} label={value} selected={host === value} onPress={() => { setHost(value); setPermission(policies.data?.find(p => p.host === value)?.permission_reference ?? ""); }} />)}</View>
      <Field label="Permission or review reference" value={permission} onChangeText={setPermission} placeholder="Record authorization, permitted use and the evidence reference" multiline />
      <Button label="Enable approved source" disabled={permission.trim().length < 10 || source.isPending} onPress={() => source.mutate(true)} />
      <Button className="mt-3" variant="secondary" label="Disable source" disabled={permission.trim().length < 10 || source.isPending} onPress={() => source.mutate(false)} />
      {policies.data?.map(item => <Body key={item.host} className="mt-3">{item.host}: {item.enabled ? "enabled" : "disabled"} · {item.permission_reference}</Body>)}
    </Card>
    <Card>
      <Text className="font-display text-xl text-foreground dark:text-dark-foreground">Requested account removals</Text>
      <Body className="mt-2">Completion removes personal application/waiver/attendance data, closes authentication in production, and unpublishes an organizer's listings. This action cannot be undone.</Body>
      {!deletions.data?.length ? <Body className="mt-4">No pending requests.</Body> : deletions.data.map(item => <View key={item.id} className="mt-4">
        <Body>{item.name} · {item.email}</Body>
        {selectedDeletion === item.id ? <><Button className="mt-2" variant="danger" label={`Confirm permanent removal of ${item.name}`} loading={remove.isPending} onPress={() => remove.mutate(item.id)} /><Button className="mt-2" variant="secondary" label="Cancel removal" onPress={() => setSelectedDeletion(null)} /></> : <Button className="mt-2" variant="secondary" label={`Review removal of ${item.name}`} onPress={() => setSelectedDeletion(item.id)} />}
      </View>)}
    </Card>
  </Screen>;
}
