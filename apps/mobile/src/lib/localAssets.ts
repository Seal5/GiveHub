import type { ImageSourcePropType } from "react-native";

const opportunityImages: Record<string, ImageSourcePropType> = {
  "beach-clean": require("../../assets/opportunities/beach-clean.jpg"),
  "garden-day": require("../../assets/opportunities/garden-day.jpg"),
  "stream-watch": require("../../assets/opportunities/stream-watch.jpg"),
  "hutt-planting": require("../../assets/opportunities/hutt-planting.jpg"),
  "porirua-food-rescue": require("../../assets/opportunities/porirua-food-rescue.jpg"),
};

export function opportunityImage(id: string, remoteUrl?: string | null): ImageSourcePropType | undefined {
  return opportunityImages[id] ?? (remoteUrl ? { uri: remoteUrl } : undefined);
}
