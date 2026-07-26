import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { Display, EmptyState, ErrorState, Eyebrow, LoadingState, Screen } from "@/components/ui";
import { EventCard } from "@/components/EventCard";

export default function SavedScreen() {
  const { token } = useAuth();
  const query = useQuery({ queryKey: ["opportunities", "saved"], queryFn: () => api.opportunities({ saved: true }, token) });
  return (
    <Screen refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      <Eyebrow>Saved opportunities</Eyebrow>
      <Display className="mb-7 text-[30px] leading-8">Keep the good ones close.</Display>
      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data?.length ? (
        query.data.map((item) => <EventCard key={item.id} item={item} compact />)
      ) : (
        <EmptyState title="Nothing saved yet" body="Tap the bookmark on any opportunity to keep it here." />
      )}
    </Screen>
  );
}
