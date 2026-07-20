import "react-native-url-polyfill/auto";
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
        storage: secureStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

