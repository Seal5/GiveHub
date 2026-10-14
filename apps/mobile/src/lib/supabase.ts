import "react-native-url-polyfill/auto";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createClient, type SupportedStorage } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const secureStorage: SupportedStorage = {
  getItem: (storageKey) => SecureStore.getItemAsync(storageKey),
  setItem: (storageKey, value) => SecureStore.setItemAsync(storageKey, value),
  removeItem: (storageKey) => SecureStore.deleteItemAsync(storageKey),
};

export const hasSupabase = Boolean(url && key);
export const supabase = hasSupabase
  ? createClient(url!, key!, {
      auth: {
        // SecureStore is native-only; Supabase supplies browser storage on web.
        ...(Platform.OS === "web" ? {} : { storage: secureStorage }),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

