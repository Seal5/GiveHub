import { useEffect, useRef, useState } from "react";
import { Image, Modal, Platform, Pressable, ScrollView, Share, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/providers/AuthProvider";
import { Body, BrandMark, Button, Card, Chip, Display, EmptyState, ErrorState, Eyebrow, Field, Heading, IconButton, LoadingState, Screen, useThemeColours } from "./ui";
import { community, communityDate, coverUrl, downloadCommunityFile, gatheringShareUrl, gatheringWebUrl, readRsvpKey, saveRsvpKey, type CommunityGuest, type Gathering, type GatheringInput, type GatheringTheme, type RSVPChoice, type RSVPStatus } from "@/lib/community";

const themes: Record<GatheringTheme, { background: string; ink: string; accent: string; name: string; icon: keyof typeof Ionicons.glyphMap }> = {
  citrus: { background: "#ECEFA9", ink: "#254832", accent: "#EB9865", name: "Citrus", icon: "restaurant-outline" },
  moss: { background: "#DDE8D9", ink: "#234934", accent: "#AFC391", name: "Moss", icon: "leaf-outline" },
  rose: { background: "#F0D3D8", ink: "#743D4B", accent: "#E6A580", name: "Rose", icon: "flower-outline" },
  midnight: { background: "#253E45", ink: "#FAF1CD", accent: "#91AFA2", name: "After hours", icon: "moon-outline" },
};
const push = (path: string) => router.push(path as Parameters<typeof router.push>[0]);
const ownerPath = (id: string) => `/(organiser)/community-event/${id}`;
const publicPath = (id: string) => `/g/${id}`;
const statusLabels: Record<RSVPStatus, string> = { going: "Going", maybe: "Maybe", declined: "Can't go", pending: "Awaiting approval", waitlisted: "On the waitlist" };
const errorOf = (...values: (Error | null | undefined)[]) => values.find(Boolean);
function Status({ label }: { label: string }) {
  return <View className="self-start rounded-full bg-secondary px-3 py-1.5 dark:bg-dark-secondary"><Text className="font-strong text-[10px] uppercase tracking-[1px] text-primary dark:text-dark-primary">{label}</Text></View>;
}
function Notice({ children }: { children: string }) {
  return <View accessibilityLiveRegion="polite" className="my-3 rounded-card bg-secondary p-4 dark:bg-dark-secondary"><Body>{children}</Body></View>;
}
function InlineError({ error }: { error?: Error | null }) {
  return error ? <Text accessibilityRole="alert" className="my-3 font-sans text-sm text-destructive dark:text-dark-destructive">{error.message}</Text> : null;
}
function Toggle({ label, detail, value, onChange }: { label: string; detail?: string; value: boolean; onChange: (v: boolean) => void }) {
  const c = useThemeColours();
  return <View className="mb-5 flex-row items-center gap-4"><View className="flex-1"><Text className="font-strong text-sm text-foreground dark:text-dark-foreground">{label}</Text>{detail ? <Body className="mt-1">{detail}</Body> : null}</View><Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: c.primary, false: c.border }} /></View>;
}
export function GatheringPoster({ event, compact = false }: { event: Pick<GatheringInput, "title" | "theme" | "cover_url">; compact?: boolean }) {
  const theme = themes[event.theme] ?? themes.moss;
  return <View className="overflow-hidden rounded-feature" style={{ backgroundColor: theme.background, minHeight: compact ? 170 : 220, padding: compact ? 18 : 22, justifyContent: "space-between" }}>
    {event.cover_url ? <Image accessibilityLabel="Event cover" source={{ uri: coverUrl(event.cover_url) }} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} resizeMode="cover" /> : <>
      <View style={{ position: "absolute", width: 230, height: 230, borderRadius: 150, borderWidth: 1, borderColor: theme.ink, opacity: 0.12, top: -80, right: -60 }} />
      <View style={{ position: "absolute", width: 190, height: 190, borderRadius: 120, backgroundColor: theme.accent, opacity: 0.45, bottom: -80, left: -70 }} />
    </>}
    <View className="self-start rounded-full px-3 py-2" style={{ backgroundColor: theme.background }}><Text style={{ color: theme.ink }} className="font-strong text-[9px] uppercase tracking-[2px]">GiveHub · together</Text></View>
    <View style={event.cover_url ? { backgroundColor: theme.background, padding: 18, borderRadius: 16, marginTop: 30 } : { marginVertical: 20 }}>
      <Ionicons name={theme.icon} size={compact ? 22 : 26} color={theme.ink} />
      <Text accessibilityRole="header" style={{ color: theme.ink, fontSize: compact ? 24 : 28, lineHeight: compact ? 30 : 35, marginTop: 10 }} className="font-display tracking-[-0.6px]">{event.title || "Something good starts here."}</Text>
    </View>
    <Text style={{ color: theme.ink, backgroundColor: event.cover_url ? theme.background : "transparent", alignSelf: "flex-start" }} className="font-medium text-[10px] uppercase tracking-[2px]">Good people. Shared purpose.</Text>
  </View>;
}
function EventCard({ event, host = false }: { event: Gathering; host?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${host ? "Manage" : "Open"} ${event.title}`} onPress={() => push(host ? ownerPath(event.id) : publicPath(event.id))} className="mb-5 overflow-hidden rounded-feature border border-border bg-card dark:border-dark-border dark:bg-dark-card">
    <GatheringPoster event={event} compact />
    <View className="p-4"><View className="mb-2 flex-row items-center justify-between"><Status label={host ? event.status : `${event.going} going`} /><Ionicons name="arrow-forward" size={19} color="#2A8D58" /></View><Body>{communityDate(event)}</Body><Body className="mt-1">{event.host_name}</Body></View>
  </Pressable>;
}

export function CommunityDiscoveryScreen() {
  const events = useQuery({ queryKey: ["community", "public"], queryFn: community.list });
  return <Screen className="pt-5" refreshing={events.isRefetching} onRefresh={() => { void events.refetch(); }}>
    <View className="mb-6 flex-row items-center justify-between"><BrandMark /><Status label="Community" /></View>
    <Eyebrow>Less scrolling. More showing up.</Eyebrow>
    <Display className="text-[30px] leading-[36px]">Good people.{"\n"}Shared purpose.</Display>
    <Body className="mb-6 mt-3">Suppers, meetups, and little reasons to get together. Find your next good thing.</Body>
    <View className="mb-5 flex-row items-center justify-between"><Heading>You're invited</Heading><Text className="font-mono text-xs text-muted-foreground dark:text-dark-muted-foreground">{events.data?.length ?? "—"} upcoming</Text></View>
    {events.isPending ? <LoadingState label="Finding community events…" /> : events.isError ? <ErrorState error={events.error} onRetry={() => { void events.refetch(); }} /> : !events.data.length ? <EmptyState title="Good things are on the way" body="When hosts publish community events, you'll find them here. You can also open a private invitation link." /> : events.data.map(event => <EventCard key={event.id} event={event} />)}
    <Card className="mt-4"><Eyebrow>A different way to connect</Eyebrow><Heading>Come for the cause. Stay for the company.</Heading><Body className="mt-3">Community RSVPs are invitations to get together. Volunteer applications, agreements, and credited hours still live in Opportunities and Activities.</Body></Card>
  </Screen>;
}

export function CommunityHostScreen() {
  const { token } = useAuth();
  const events = useQuery({ queryKey: ["community", "hosted"], queryFn: () => community.hosted(token) });
  return <Screen className="pt-5" refreshing={events.isRefetching} onRefresh={() => { void events.refetch(); }}>
    <Eyebrow>Bring your community together</Eyebrow>
    <Display className="text-[30px] leading-[36px]">Your gatherings.</Display>
    <Body className="mb-5 mt-3">Make a plan, send one link, and bring your people together.</Body>
    <Button className="mb-6" label="Create community event" icon={<Ionicons name="add" size={19} color="white" />} onPress={() => push("/(organiser)/community-create")} />
    {events.isPending ? <LoadingState /> : events.isError ? <ErrorState error={events.error} onRetry={() => { void events.refetch(); }} /> : !events.data.length ? <EmptyState title="Your next gathering starts here" body="Create a draft, make it yours, and publish when you're ready to invite people." /> : events.data.map(event => <EventCard key={event.id} event={event} host />)}
  </Screen>;
}

function defaultEvent(): GatheringInput {
  const date = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  return { title: "", description: "", location: "", timezone: "America/Toronto", starts_local: `${date}T18:00`, ends_local: `${date}T21:00`, theme: "moss", cover_url: "", capacity: null, max_plus_ones: 0, approval_required: false, guest_list_visible: true, address_after_rsvp: false, listed: true, reminder_enabled: true, questions: [] };
}
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const c = useThemeColours();
  if (Platform.OS !== "web") return <Field label={label} value={value} onChangeText={onChange} placeholder="YYYY-MM-DDTHH:MM" />;
  return <View className="mb-4"><Text className="mb-2 font-strong text-xs uppercase tracking-[1.3px] text-muted-foreground dark:text-dark-muted-foreground">{label}</Text><input aria-label={label} type="datetime-local" value={value} onChange={e => onChange(e.target.value)} style={{ boxSizing: "border-box", width: "100%", minWidth: 0, minHeight: 56, border: `1px solid ${c.border}`, background: c.card, color: c.foreground, padding: 15, borderRadius: 18, fontFamily: "DMSans_400Regular, sans-serif", fontSize: 14 }} /></View>;
}
export function CommunityEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { token } = useAuth();
  const client = useQueryClient();
  const [step, setStep] = useState(0);
  const scroll = useRef<ScrollView>(null);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [step]);
  const [form, setForm] = useState<GatheringInput>(defaultEvent);
  const event = useQuery({ queryKey: ["community", "host", id], queryFn: () => community.hostEvent(id!, token), enabled: Boolean(id) });
  useEffect(() => { if (event.data) setForm(event.data); }, [event.data]);
  const set = <K extends keyof GatheringInput>(key: K, value: GatheringInput[K]) => setForm(old => ({ ...old, [key]: value }));
  const save = useMutation({ mutationFn: () => community.save(form, token, id), onError: () => scroll.current?.scrollTo({ y: 0, animated: true }), onSuccess: async data => { await client.invalidateQueries({ queryKey: ["community"] }); router.replace(ownerPath(data.id) as Parameters<typeof router.replace>[0]); } });
  const upload = useMutation({ mutationFn: async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], base64: true, quality: 0.7, allowsEditing: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.base64) throw new Error("This image could not be read. Try another image.");
    const data = await community.upload(`data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`, token);
    set("cover_url", data.url);
  } });
  if (id && event.isPending) return <Screen><LoadingState /></Screen>;
  if (event.isError) return <Screen><ErrorState error={event.error} onRetry={() => { void event.refetch(); }} /></Screen>;
  return <Screen className="pt-5" scrollRef={scroll} footer={<View className="flex-row items-center gap-3">
    {step > 0 ? <Button label="Back" variant="secondary" onPress={() => setStep(step - 1)} /> : null}
    <View className="flex-1"><Button label={step === 0 ? "Continue to style" : step === 1 ? "Continue to guests" : id ? "Save event changes" : "Save draft"} loading={save.isPending} disabled={form.title.trim().length < 3} onPress={() => step < 2 ? setStep(step + 1) : save.mutate()} /></View>
  </View>}>
    <IconButton icon="arrow-back" label="Back to community events" onPress={() => push("/(organiser)/community")} className="mb-5" />
    <Eyebrow>Step {step + 1} of 3 · {['The plan', 'Look & feel', 'Your guests'][step]}</Eyebrow>
    <Display className="mb-5 text-[28px] leading-[34px]">{step === 0 ? "What's the occasion?" : step === 1 ? "Make it feel like you." : "A little room for everyone."}</Display>
    <InlineError error={save.error} />
    <View>
      {step === 1 ? <View>
        <GatheringPoster event={form} compact />
        <View className="mb-4 mt-5 flex-row flex-wrap gap-y-2">{(Object.keys(themes) as GatheringTheme[]).map(theme => <Chip key={theme} label={themes[theme].name} selected={form.theme === theme} onPress={() => set("theme", theme)} />)}</View>
        <Button label="Upload a cover image" variant="secondary" loading={upload.isPending} onPress={() => upload.mutate()} />
        {form.cover_url ? <Button label="Use theme artwork" className="mt-3" variant="secondary" onPress={() => set("cover_url", "")} /> : null}
        <Body className="mt-3">JPG, PNG or WebP · under 3 MB</Body><InlineError error={upload.error} />
      </View> : null}
      <View>
        {step === 0 ? <Card className="mb-5">
          <Field label="Event title" value={form.title} onChangeText={value => set("title", value)} placeholder="Something worth getting together for" maxLength={100} />
          <Field label="What's the plan?" value={form.description} onChangeText={value => set("description", value)} placeholder="Set the scene. Tell people what to expect and what to bring." multiline numberOfLines={5} style={{ minHeight: 140, textAlignVertical: "top" }} maxLength={5000} />
          <DateField label="Starts" value={form.starts_local} onChange={value => set("starts_local", value)} />
          <DateField label="Ends" value={form.ends_local} onChange={value => set("ends_local", value)} />
          <Field label="Timezone" value={form.timezone} onChangeText={value => set("timezone", value)} placeholder="America/Toronto" />
          <Field label="Location" value={form.location} onChangeText={value => set("location", value)} placeholder="Venue and address, or a meeting link" />
        </Card> : null}
        {step === 2 ? <><Card className="mb-5"><Heading className="mb-5">Your guest list</Heading>
          <Field label="Capacity (leave blank for unlimited)" keyboardType="number-pad" value={form.capacity?.toString() ?? ""} onChangeText={value => set("capacity", value ? Number(value.replace(/[^0-9]/g, "")) : null)} />
          <Body className="mb-4">Capacity includes additional guests. When full, new requests join the waitlist. The first waiting party moves up when enough room opens.</Body>
          <Field label="Additional guests allowed per RSVP" keyboardType="number-pad" value={String(form.max_plus_ones)} onChangeText={value => set("max_plus_ones", Number(value.replace(/[^0-9]/g, "")))} />
          <Toggle label="Approve guests before they join" value={form.approval_required} onChange={value => set("approval_required", value)} />
          <Toggle label="Let guests see who's going" value={form.guest_list_visible} onChange={value => set("guest_list_visible", value)} />
          <Toggle label="Reveal the location after confirmation" value={form.address_after_rsvp} onChange={value => set("address_after_rsvp", value)} />
          <Toggle label="Show in Community discovery" detail="Turn off for an unlisted event people open through your invitation link." value={form.listed} onChange={value => set("listed", value)} />
          <Toggle label="Remind confirmed guests 24 hours before" detail="Guests choose whether to receive reminders. Email updates require a verified GiveHub account." value={form.reminder_enabled} onChange={value => set("reminder_enabled", value)} />
        </Card>
        <Card className="mb-5"><Heading>Ask a little upfront</Heading><Body className="mb-5 mt-2">Dietary needs, access requests, or something fun. Only you can see the answers.</Body>
          {form.questions.map((q, index) => <View key={q.id} className="mb-4 border-b border-border pb-4 dark:border-dark-border"><Field label={`Question ${index + 1}`} value={q.label} onChangeText={label => set("questions", form.questions.map(item => item.id === q.id ? { ...item, label } : item))} /><Toggle label={`Require an answer to question ${index + 1}`} value={q.required} onChange={required => set("questions", form.questions.map(item => item.id === q.id ? { ...item, required } : item))} /><Button label={`Remove question ${index + 1}`} variant="secondary" onPress={() => set("questions", form.questions.filter(item => item.id !== q.id))} /></View>)}
          {form.questions.length < 10 ? <Button label="Add a question" variant="secondary" onPress={() => set("questions", [...form.questions, { id: `q_${Date.now()}`, label: "", required: false }])} /> : null}
        </Card>
        <Body className="mb-6 mt-3">Save now, review your invitation, then publish when you're ready.</Body></> : null}
      </View>
    </View>
  </Screen>;
}

export function CommunityInvitationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, token, loading } = useAuth();
  const c = useThemeColours();
  const client = useQueryClient();
  const scroll = useRef<ScrollView>(null);
  const rsvpAnchor = useRef<View>(null);
  const openRsvp = () => {
    if (Platform.OS === "web") {
      (rsvpAnchor.current as unknown as HTMLElement | null)?.scrollIntoView({ block: "start", behavior: "smooth" });
      return;
    }
    const container = scroll.current;
    if (!container) return;
    rsvpAnchor.current?.measureLayout(container.getInnerViewNode(), (_x, y) => {
      container.scrollTo({ y: Math.max(0, y - 12), animated: true });
    });
  };
  const [key, setKey] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ name: profile?.display_name ?? "", email: profile?.email ?? "", choice: "going" as RSVPChoice, plus_ones: 0, answers: {} as Record<string, string>, email_updates: false });
  useEffect(() => { let active = true; setReady(false); void readRsvpKey(id).then(value => { if (active) { setKey(value); setReady(true); } }); return () => { active = false; }; }, [id]);
  const event = useQuery({ queryKey: ["community", "invitation", id, token, key], queryFn: () => community.event(id, token, key), enabled: ready && !loading });
  useEffect(() => { const mine = event.data?.my_rsvp; if (mine) setForm({ name: mine.name, email: mine.email, choice: mine.choice, plus_ones: mine.plus_ones, answers: mine.answers, email_updates: mine.email_updates }); else if (profile) setForm(old => ({ ...old, name: profile.display_name, email: profile.email })); }, [event.data?.my_rsvp, profile]);
  const save = useMutation({ mutationFn: () => community.rsvp(id, form, token, key), onSuccess: async data => {
    if (data.edit_key) { await saveRsvpKey(id, data.edit_key); setKey(data.edit_key); }
    setMessage(`You're all set. ${statusLabels[data.rsvp.status]}.`); await client.invalidateQueries({ queryKey: ["community"] });
  } });
  const action = useMutation({ mutationFn: async (kind: "share" | "calendar" | "private") => {
    if (kind === "calendar") { await downloadCommunityFile(await community.calendar(id), "givehub-event.ics", "text/calendar"); return; }
    const url = kind === "private" ? `${gatheringWebUrl(id)}#rsvp=${key}` : gatheringShareUrl(id);
    if (Platform.OS === "web" && navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); setMessage(kind === "private" ? "Private edit link copied. Keep it for yourself; anyone with it can edit your RSVP." : "Invitation link copied. Send it to your people."); }
    else await Share.share({ title: event.data?.title ?? "GiveHub invitation", message: url });
  } });
  const back = () => push(profile?.role === "organiser" ? "/(organiser)/community" : profile ? "/(volunteer)/social" : "/welcome");
  if (!ready || loading || event.isPending) return <Screen><LoadingState label="Opening your invitation…" /></Screen>;
  if (event.isError) return <Screen><IconButton icon="arrow-back" label="Back to GiveHub" onPress={back} /><ErrorState error={event.error} onRetry={() => { void event.refetch(); }} /></Screen>;
  const data = event.data;
  const closed = data.status !== "published" || new Date(data.ends_at) <= new Date();
  return <Screen className="pt-4" scrollRef={scroll} footer={closed ? undefined : <View className="flex-row items-center gap-4">
    <View className="flex-1"><Text className="font-strong text-sm text-foreground dark:text-dark-foreground">{data.my_rsvp ? statusLabels[data.my_rsvp.status] : "You're invited"}</Text><Body>{data.capacity ? `${Math.max(0, data.capacity - data.going)} spots available` : "There's a spot for you"}</Body></View>
    <Button label={data.my_rsvp ? "Edit RSVP" : "RSVP"} onPress={openRsvp} />
  </View>}>
    <View className="mb-5 flex-row items-center justify-between"><Pressable accessibilityRole="button" accessibilityLabel="Back to GiveHub" onPress={back}><BrandMark /></Pressable><IconButton icon="share-outline" label="Share invite" onPress={() => action.mutate("share")} /></View>
    <GatheringPoster event={data} />
    <Body className="mb-4 mt-3">Hosted by {data.host_name}</Body>
    <Card className="mb-5 p-4"><View className="mb-3 flex-row gap-3"><Ionicons name="calendar-outline" size={20} color={c.primary} /><View className="flex-1"><Text className="font-strong text-sm text-foreground dark:text-dark-foreground">{communityDate(data)}</Text><Body className="mt-1">Ends {new Intl.DateTimeFormat("en-CA", { timeZone: data.timezone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(data.ends_at))}</Body></View></View><View className="flex-row gap-3"><Ionicons name="location-outline" size={20} color={c.primary} /><Body className="flex-1">{data.location_hidden ? "Location shared after your RSVP is confirmed." : data.location}</Body></View></Card>
    <View ref={rsvpAnchor} collapsable={false}>
      <Card><Status label={data.status === "draft" ? "Draft preview" : data.status === "cancelled" ? "Cancelled" : data.my_rsvp ? statusLabels[data.my_rsvp.status] : "Save your spot"} /><Heading className="mt-5">{data.my_rsvp ? "Your RSVP, your call." : "Will we see you there?"}</Heading><Body className="mb-5 mt-2">{data.capacity ? `${data.going} of ${data.capacity} spots filled. ` : "There's room for good company. "}{data.approval_required ? "The host reviews requests to join." : "Can't make it? You can change your answer later."}</Body>
          {closed ? <Notice>{data.status === "cancelled" ? "The host has cancelled this event." : data.status === "draft" ? "This is a draft invitation. Publish it before collecting RSVPs." : "This event has ended. Thanks for being part of the community."}</Notice> : <>
            <View className="mb-5 flex-row flex-wrap gap-y-2">{(["going", "maybe", "declined"] as RSVPChoice[]).map(choice => <Chip key={choice} label={statusLabels[choice]} selected={form.choice === choice} onPress={() => setForm(old => ({ ...old, choice }))} />)}</View>
            <Field label="Your name" value={form.name} onChangeText={name => setForm(old => ({ ...old, name }))} autoComplete="name" />
            <Field label="Email address" value={form.email} onChangeText={email => setForm(old => ({ ...old, email }))} keyboardType="email-address" autoCapitalize="none" editable={!profile || Boolean(key)} autoComplete="email" />
            {form.choice === "going" && data.max_plus_ones > 0 ? <View className="mb-5"><Text className="mb-3 font-strong text-xs text-muted-foreground dark:text-dark-muted-foreground">BRINGING SOMEONE?</Text><View className="flex-row flex-wrap gap-y-2">{Array.from({ length: data.max_plus_ones + 1 }, (_, n) => <Chip key={n} label={n === 0 ? "Just me" : `+${n}`} selected={form.plus_ones === n} onPress={() => setForm(old => ({ ...old, plus_ones: n }))} />)}</View></View> : null}
            {form.choice !== "declined" ? data.questions.map(question => <Field key={question.id} label={`${question.label}${question.required ? " *" : ""}`} value={form.answers[question.id] ?? ""} onChangeText={answer => setForm(old => ({ ...old, answers: { ...old.answers, [question.id]: answer } }))} multiline maxLength={1000} />) : null}
            <Body className="mb-4">Your email and answers are only visible to the host. Your name appears in the guest list if the host enables it.</Body>
            <Toggle label="Keep me in the loop by email" detail="Event updates and reminders only. Email requires a verified GiveHub account; you can also read host updates on this invitation." value={form.email_updates} onChange={email_updates => setForm(old => ({ ...old, email_updates }))} />
            <InlineError error={save.error} /><Button label={data.my_rsvp ? "Update my RSVP" : "Send RSVP"} loading={save.isPending} onPress={() => save.mutate()} />
            {key ? <Button className="mt-3" label="Copy my private edit link" variant="secondary" onPress={() => action.mutate("private")} /> : null}
          </>}
          {message ? <Notice>{message}</Notice> : null}<InlineError error={action.error} />
        </Card>
    </View>
    <View className="mt-7"><Heading>The plan</Heading><Body className="mb-5 mt-3 text-base leading-6">{data.description}</Body>
      {data.status === "published" ? <Button label="Add to calendar" variant="secondary" onPress={() => action.mutate("calendar")} /> : null}
    </View>
    {data.announcements.length ? <View className="mt-7"><Heading>A note from your host</Heading>{data.announcements.map(note => <Card className="mt-3" key={note.id}><Body>{note.body}</Body></Card>)}</View> : null}
    <View className="mt-7"><Heading>{data.going} good {data.going === 1 ? "person" : "people"} going</Heading>{data.guest_list_visible ? <View className="mt-4 flex-row flex-wrap gap-2">{data.guests.map((guest, index) => <View key={`${index}-${guest.name}`} className="rounded-full border border-border bg-card px-4 py-2 dark:border-dark-border dark:bg-dark-card"><Text className="font-medium text-xs text-foreground dark:text-dark-foreground">{guest.name}{guest.plus_ones ? ` +${guest.plus_ones}` : ""}</Text></View>)}</View> : <Body className="mt-3">The host keeps the guest list private.</Body>}</View>
    <Body className="mt-7 text-center">Made for real people, showing up together.</Body>
  </Screen>;
}

function GuestSheet({ guest, event, pending, error, onClose, onDecision }: { guest?: CommunityGuest; event: Gathering; pending: boolean; error: Error | null; onClose: () => void; onDecision: (status: RSVPStatus) => void }) {
  return <Modal visible={Boolean(guest)} transparent animationType="slide" onRequestClose={onClose}>
    <View className="flex-1 justify-end bg-black/40">
      <View className="overflow-hidden rounded-t-3xl" style={{ width: "100%", maxWidth: 480, height: "85%", alignSelf: "center" }}>
        <SafeAreaView edges={["bottom"]} className="flex-1 bg-card dark:bg-dark-card">
          <View className="flex-row items-center justify-between border-b border-border px-5 py-3 dark:border-dark-border"><Heading>Guest details</Heading><IconButton icon="close" label="Close guest details" onPress={onClose} /></View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
            {guest ? <><Heading>{guest.name}</Heading><Body className="my-3">{guest.email} · {guest.plus_ones} additional guests</Body><Status label={statusLabels[guest.status]} /><Body className="mt-4">Guest's response: {statusLabels[guest.choice]}</Body>
              {event.questions.map(q => <View key={q.id} className="mt-4"><Text className="font-strong text-xs text-foreground dark:text-dark-foreground">{q.label}</Text><Body className="mt-1">{guest.answers[q.id] || "No answer provided"}</Body></View>)}
              <Body className="mt-5">Contact details and answers are private to you.</Body><InlineError error={error} />
              <View className="mt-5 gap-3"><Button label="Confirm guest" disabled={pending || guest.choice !== "going" || event.status !== "published"} onPress={() => onDecision("going")} /><Button label="Move to waitlist" variant="secondary" disabled={pending || guest.choice !== "going" || event.status !== "published"} onPress={() => onDecision("waitlisted")} /><Button label="Decline guest" variant="secondary" disabled={pending || event.status !== "published"} onPress={() => onDecision("declined")} /></View>
            </> : null}
          </ScrollView>
        </SafeAreaView>
      </View>
    </View>
  </Modal>;
}

export function CommunityManageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const client = useQueryClient();
  const [tab, setTab] = useState<"guests" | "updates">("guests");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const event = useQuery({ queryKey: ["community", "host", id], queryFn: () => community.hostEvent(id, token) });
  const guests = useQuery({ queryKey: ["community", "guests", id], queryFn: () => community.guests(id, token) });
  const deliveries = useQuery({ queryKey: ["community", "deliveries", id], queryFn: () => community.deliveries(id, token), enabled: tab === "updates" });
  const refresh = () => client.invalidateQueries({ queryKey: ["community"] });
  const state = useMutation({ mutationFn: (status: Gathering["status"]) => community.state(event.data!, status, token), onSuccess: async () => { setConfirmCancel(false); await refresh(); } });
  const decide = useMutation({ mutationFn: ({ guest, status }: { guest: string; status: RSVPStatus }) => community.decide(id, guest, status, token), onSuccess: refresh });
  const send = useMutation({ mutationFn: async () => { await community.announce(id, note, token); await community.process(id, token); }, onSuccess: async () => { setNote(""); setMessage("Update posted. Check delivery status below for each opted-in guest."); await refresh(); } });
  const action = useMutation({ mutationFn: async (kind: "csv" | "share" | "process") => {
    if (kind === "csv") await downloadCommunityFile(await community.csv(id, token), "givehub-guests.csv", "text/csv");
    else if (kind === "process") { await community.process(id, token); await refresh(); setMessage("Due messages processed. Future reminders stay scheduled."); }
    else if (Platform.OS === "web" && navigator.clipboard?.writeText) { await navigator.clipboard.writeText(gatheringShareUrl(id)); setMessage("Invitation link copied. Share it with your people."); }
    else await Share.share({ title: event.data?.title, message: gatheringShareUrl(id) });
  } });
  if (event.isPending) return <Screen><LoadingState /></Screen>;
  if (event.isError) return <Screen><ErrorState error={event.error} onRetry={() => { void event.refetch(); }} /></Screen>;
  const data = event.data;
  const selected = guests.data?.find(guest => guest.id === selectedId);
  const filtered = guests.data?.filter(guest => filter === "all" || guest.status === filter) ?? [];
  return <Screen className="pt-5" refreshing={event.isRefetching} onRefresh={() => { void refresh(); }}>
    <IconButton icon="arrow-back" label="Back to community events" className="mb-5" onPress={() => push("/(organiser)/community")} />
    <View className="mb-3"><Status label={data.status} /><View className="mt-3"><Eyebrow>Your gathering</Eyebrow><Display className="text-[28px] leading-[34px]">{data.title}</Display><Body className="mt-3">{communityDate(data)}</Body></View></View>
    <View className="my-5 flex-row flex-wrap gap-3"><Button label="View invitation" variant="secondary" onPress={() => push(publicPath(id))} /><Button label="Edit event" variant="secondary" disabled={data.status === "cancelled"} onPress={() => push(`/(organiser)/community-edit/${id}`)} />{data.status === "draft" ? <Button label="Publish invitation" loading={state.isPending} onPress={() => state.mutate("published")} /> : data.status === "published" ? <Button label="Copy invite link" onPress={() => action.mutate("share")} /> : null}</View>
    <InlineError error={errorOf(state.error, action.error, decide.error, send.error)} />{message ? <Notice>{message}</Notice> : null}
    <View className="mb-5 flex-row flex-wrap justify-between gap-y-3">{[[String(data.going), "Going"], [String(data.responses), "Responses"], [String(guests.data?.filter(g => g.status === "pending").length ?? 0), "To review"], [data.capacity === null ? "∞" : String(Math.max(0, data.capacity - data.going)), "Spots left"]].map(([value, label]) => <View key={label} style={{ width: "48%" }}><Card className="p-4"><Text className="font-display text-3xl text-primary dark:text-dark-primary">{value}</Text><Body className="mt-1">{label}</Body></Card></View>)}</View>
    <View className="mb-6 flex-row gap-3"><Chip label="Guests" selected={tab === "guests"} onPress={() => setTab("guests")} /><Chip label="Updates" selected={tab === "updates"} onPress={() => setTab("updates")} /></View>
    {tab === "guests" ? <>
      <View className="mb-5 flex-row flex-wrap items-center justify-between gap-3"><ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ width: "100%" }}>{["all", "going", "pending", "waitlisted", "maybe", "declined"].map(value => <Chip key={value} label={value === "all" ? "All guests" : statusLabels[value as RSVPStatus]} selected={filter === value} onPress={() => setFilter(value)} />)}</ScrollView><Button label="Export guest CSV" variant="secondary" onPress={() => action.mutate("csv")} /></View>
      {guests.isPending ? <LoadingState /> : guests.isError ? <ErrorState error={guests.error} onRetry={() => { void guests.refetch(); }} /> : <View><View style={{ flex: 1, minWidth: 0 }}>{!filtered.length ? <EmptyState title="A little room for good company" body="Share the published invitation to collect RSVPs. Guests matching this filter will appear here." /> : filtered.map(guest => <Pressable key={guest.id} accessibilityRole="button" accessibilityLabel={`Review ${guest.name}`} onPress={() => setSelectedId(guest.id)} className={`mb-3 rounded-card border p-5 ${selectedId === guest.id ? "border-primary bg-secondary dark:border-dark-primary dark:bg-dark-secondary" : "border-border bg-card dark:border-dark-border dark:bg-dark-card"}`}><View className="flex-row flex-wrap items-center justify-between gap-3"><View style={{ flex: 1, minWidth: 0 }}><Text className="font-strong text-base text-foreground dark:text-dark-foreground">{guest.name}{guest.plus_ones ? ` +${guest.plus_ones}` : ""}</Text><Text numberOfLines={1} className="mt-1 font-sans text-sm text-muted-foreground dark:text-dark-muted-foreground">{guest.email}</Text></View><Status label={statusLabels[guest.status]} /></View></Pressable>)}</View>
</View>}
    </> : <View className="gap-6">
      <View style={{ flex: 1 }}><Card><Heading>One update. Everyone in the loop.</Heading><Body className="mb-5 mt-3">Post a note on the invitation and notify opted-in guests. Unverified emails and unconfigured delivery stay in local preview.</Body><Field label="Your update" value={note} onChangeText={setNote} multiline maxLength={2000} style={{ minHeight: 140, textAlignVertical: "top" }} placeholder="The good stuff, the last-minute details, the change of plan…" /><Button label="Post guest update" loading={send.isPending} disabled={note.trim().length < 3 || data.status !== "published"} onPress={() => send.mutate()} /></Card>{data.announcements.map(note => <Card className="mt-4" key={note.id}><Body>{note.body}</Body></Card>)}</View>
      <View style={{ flex: 1, minWidth: 0 }}><Heading>Delivery inbox</Heading><Body className="my-3">Scheduled reminders go out when due. “Local preview” means no email was sent. Check failed deliveries before sending again.</Body><Button className="mb-5" label="Process due messages" variant="secondary" loading={action.isPending} onPress={() => action.mutate("process")} />{deliveries.isPending ? <LoadingState /> : deliveries.isError ? <ErrorState error={deliveries.error} onRetry={() => { void deliveries.refetch(); }} /> : !deliveries.data.length ? <EmptyState title="All quiet for now" body="Reminders and announcements for opted-in guests will appear here." /> : deliveries.data.map(delivery => <Card key={delivery.id} className="mb-3"><Status label={delivery.state === "preview" ? "Local preview · not sent" : delivery.state} /><Text className="mt-3 font-strong text-sm text-foreground dark:text-dark-foreground">{delivery.subject}</Text><Body className="mt-2">{delivery.recipient}</Body><Body className="mt-2">{delivery.body}</Body><Body className="mt-3">Due: {new Date(delivery.due_at.endsWith("Z") || /[+-]\d\d:\d\d$/.test(delivery.due_at) ? delivery.due_at : `${delivery.due_at}Z`).toLocaleString()}</Body>{delivery.error ? <Body className="mt-2">{delivery.error}</Body> : null}</Card>)}</View>
    </View>}
    <GuestSheet guest={selected} event={data} pending={decide.isPending} error={decide.error} onClose={() => setSelectedId(null)} onDecision={status => selected && decide.mutate({ guest: selected.id, status })} />
    {data.status !== "cancelled" ? <Card className="mt-8"><Heading>Plans change.</Heading><Body className="mb-4 mt-2">Cancelling closes RSVPs, stops pending reminders, and queues a cancellation update for opted-in guests.</Body>{confirmCancel ? <><Button label="Confirm event cancellation" variant="danger" loading={state.isPending} onPress={() => state.mutate("cancelled")} /><Button className="mt-3" label="Keep this event" variant="secondary" onPress={() => setConfirmCancel(false)} /></> : <Button label="Cancel this event" variant="secondary" onPress={() => setConfirmCancel(true)} />}</Card> : null}
  </Screen>;
}
