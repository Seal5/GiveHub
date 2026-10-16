import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { Display, EmptyState, ErrorState, Eyebrow, LoadingState, Screen } from "@/components/ui";
import { StatusCard } from "@/components/StatusCard";
import { Pressable, Text } from "react-native";
import { router } from "expo-router";
import { community, communityDate } from "@/lib/community";
import { Body, Card, Heading } from "@/components/ui";

export default function ActivitiesScreen() {
  const { token } = useAuth();
  const query = useQuery({ queryKey: ["applications", "me"], queryFn: () => api.myApplications(token) });
  const invites = useQuery({ queryKey: ["community", "mine"], queryFn: () => community.mine(token) });
  return (
    <Screen refreshing={query.isRefetching || invites.isRefetching} onRefresh={() => { void query.refetch(); void invites.refetch(); }}>
      <Eyebrow>My activities</Eyebrow>
      <Display className="mb-7 text-[30px] leading-8">Know what happens next.</Display>
      {invites.isError ? <ErrorState title="Community RSVPs didn't load" error={invites.error} onRetry={() => { void invites.refetch(); }} /> : invites.data?.length ? <><Heading className="mb-4">Your community RSVPs</Heading>{invites.data.map(event => <Pressable key={event.id} accessibilityRole="button" accessibilityLabel={`Open RSVP for ${event.title}`} onPress={() => router.push(`/g/${event.id}` as Parameters<typeof router.push>[0])}><Card className="mb-4"><Text className="font-strong text-xs uppercase text-primary dark:text-dark-primary">{event.status === "cancelled" ? "Event cancelled" : event.my_rsvp?.status}</Text><Heading className="mt-2">{event.title}</Heading><Body className="mt-2">{communityDate(event)}</Body><Body className="mt-2">Open your invitation to review or change your RSVP.</Body></Card></Pressable>)}<Heading className="mb-4 mt-4">Volunteer applications</Heading></> : null}
      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data?.length ? (
        query.data.map((item) => <StatusCard key={item.id} item={item} />)
      ) : (
        <EmptyState title="No applications yet" body="When you apply, every status and next step will appear here." />
      )}
    </Screen>
  );
}
