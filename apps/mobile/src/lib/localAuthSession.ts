import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { Role } from "@/lib/types";

const key = "givehub.local-auth-role";

function validRole(value: string | null): Role | null {
  return value === "volunteer" || value === "organiser" ? value : null;
}

export async function readLocalAuthRole(): Promise<Role | null> {
  if (Platform.OS === "web") {
    try {
      return validRole(globalThis.localStorage?.getItem(key) ?? null);
    } catch {
      return null;
    }
  }
  return validRole(await SecureStore.getItemAsync(key));
}

export async function writeLocalAuthRole(role: Role): Promise<void> {
  if (Platform.OS === "web") {
    try { globalThis.localStorage?.setItem(key, role); } catch { /* Local test mode can continue in memory. */ }
    return;
  }
  await SecureStore.setItemAsync(key, role);
}

export async function clearLocalAuthRole(): Promise<void> {
  if (Platform.OS === "web") {
    try { globalThis.localStorage?.removeItem(key); } catch { /* Local test mode can continue in memory. */ }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
