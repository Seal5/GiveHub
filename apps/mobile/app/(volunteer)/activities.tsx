import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { Display, EmptyState, Eyebrow, LoadingState, Screen } from "@/components/ui";
import { StatusCard } from "@/components/StatusCard";

export default function ActivitiesScreen() {
  const { token } = useAuth();
  const query = useQuery({ queryKey: ["applications", "me"], queryFn: () => api.myApplications(token) });
  return <Screen><Eyebrow>My activities</Eyebrow><Display>Know what happens next.</Display>{query.isLoading ? <LoadingState /> : <>{query.data?.length ? query.data.map((item) => <StatusCard key={item.id} item={item} />) : <EmptyState title="No applications yet" body="When you apply, every status and next step will appear here." />}</>}</Screen>;
}

