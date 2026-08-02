import { Image, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Body, Display, Screen, useThemeColours } from "@/components/ui";
import { opportunityImage } from "@/lib/localAssets";

type Friend = {
  initials: string;
  name: string;
  location: string;
  colour: string;
};

type Activity = {
  initials: string;
  name: string;
  action: "signed up for" | "completed";
  opportunity: string;
  status: "Signed up" | "Completed";
  time: string;
  location: string;
  date: string;
  colour: string;
  imageId: string;
};

const friends: Friend[] = [
  { initials: "SK", name: "Sarah", location: "Parkdale", colour: "#2A8D58" },
  { initials: "TH", name: "Tom", location: "The Beaches", colour: "#BB704B" },
  { initials: "BC", name: "Ben", location: "North York", colour: "#467A58" },
  { initials: "DW", name: "Daniel", location: "East York", colour: "#7A6852" },
];

const activities: Activity[] = [
  {
    initials: "SK",
    name: "Sarah Kim",
    action: "signed up for",
    opportunity: "Credit River Native Planting",
    status: "Signed up",
    time: "2h ago",
    location: "Mississauga",
    date: "5 Jul",
    colour: "#2A8D58",
    imageId: "hutt-planting",
  },
  {
    initials: "BC",
    name: "Ben Carter",
    action: "signed up for",
    opportunity: "Woodbine Beach Cleanup",
    status: "Signed up",
    time: "3h ago",
    location: "The Beaches",
    date: "12 Jul",
    colour: "#467A58",
    imageId: "beach-clean",
  },
  {
    initials: "DW",
    name: "Daniel Wu",
    action: "completed",
    opportunity: "Don River Water Quality Monitoring",
    status: "Completed",
    time: "Yesterday",
    location: "East York",
    date: "8 Jul",
    colour: "#7A6852",
    imageId: "stream-watch",
  },
];

function Avatar({
  initials,
  colour,
  size = 52,
}: {
  initials: string;
  colour: string;
  size?: number;
}) {
  return (
    <View
      accessibilityLabel={`${initials} profile`}
      className="items-center justify-center rounded-full"
      style={{ width: size, height: size, backgroundColor: colour }}
    >
      <Text className="font-strong text-base text-white">{initials}</Text>
    </View>
  );
}

function FriendCard({ friend }: { friend: Friend }) {
  return (
    <View className="mr-3 w-36 items-center rounded-feature border border-border bg-card px-3 py-5 dark:border-dark-border dark:bg-dark-card">
      <Avatar initials={friend.initials} colour={friend.colour} size={64} />
      <Text className="mt-3 font-strong text-sm text-foreground dark:text-dark-foreground">
        {friend.name}
      </Text>
      <Text
        numberOfLines={1}
        className="mt-0.5 font-sans text-xs text-muted-foreground dark:text-dark-muted-foreground"
      >
        {friend.location}
      </Text>
    </View>
  );
}

function ActivityCard({ activity }: { activity: Activity }) {
  const colours = useThemeColours();
  const muted = colours.mutedForeground;
  const primary = colours.primary;
  const isComplete = activity.status === "Completed";

  return (
    <View
      accessible
      accessibilityLabel={`${activity.name} ${activity.action} ${activity.opportunity}, ${activity.time}`}
      className="mb-3 rounded-feature border border-border bg-card p-4 dark:border-dark-border dark:bg-dark-card"
    >
      <View className="flex-row items-start">
        <Avatar
          initials={activity.initials}
          colour={activity.colour}
          size={48}
        />
        <View className="ml-3 flex-1" style={{ minWidth: 0 }}>
          <Text className="font-sans text-[15px] leading-5 text-muted-foreground dark:text-dark-muted-foreground">
            <Text className="font-strong text-foreground dark:text-dark-foreground">
              {activity.name}{" "}
            </Text>
            {activity.action}
          </Text>
          <Text className="mt-0.5 font-display text-[16px] leading-6 tracking-[-0.3px] text-foreground dark:text-dark-foreground">
            {activity.opportunity}
          </Text>
        </View>
        <Image
          accessibilityIgnoresInvertColors
          source={opportunityImage(activity.imageId)}
          className="ml-3 rounded-2xl bg-secondary dark:bg-dark-secondary"
          style={{ width: 64, height: 64, flexShrink: 0 }}
          resizeMode="cover"
        />
      </View>

      <View className="ml-[60px] mt-3">
        <View className="flex-row flex-wrap items-center">
          <View className="mr-3 flex-row items-center rounded-full bg-secondary px-2.5 py-1 dark:bg-dark-secondary">
            <Ionicons
              name={
                isComplete
                  ? "checkmark-done-outline"
                  : "checkmark-circle-outline"
              }
              size={15}
              color={primary}
            />
            <Text className="ml-1.5 font-medium text-xs text-secondary-foreground dark:text-dark-secondary-foreground">
              {activity.status}
            </Text>
          </View>
          <Text className="font-sans text-xs text-muted-foreground dark:text-dark-muted-foreground">
            {activity.time}
          </Text>
        </View>
        <View className="mt-2 flex-row items-center">
          <Ionicons name="location-outline" size={15} color={muted} />
          <Text className="ml-1 font-sans text-xs text-muted-foreground dark:text-dark-muted-foreground">
            {activity.location} · {activity.date}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function SocialScreen() {
  return (
    <Screen className="pb-5 pt-5">
      <Display>Social</Display>
      <Body className="mt-2 text-base">See what your friends are up to.</Body>

      <Text className="mb-4 mt-8 font-strong text-xs uppercase tracking-[1.5px] text-primary dark:text-dark-primary">
        Going this week
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="pr-5"
        className="-mr-5"
      >
        {friends.map((friend) => (
          <FriendCard key={friend.initials} friend={friend} />
        ))}
      </ScrollView>

      <Text className="mb-4 mt-8 font-strong text-xs uppercase tracking-[1.5px] text-primary dark:text-dark-primary">
        Recent activity
      </Text>
      {activities.map((activity) => (
        <ActivityCard
          key={`${activity.initials}-${activity.opportunity}`}
          activity={activity}
        />
      ))}
    </Screen>
  );
}
