import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { api, apiConfigurationError, demoMode, localAuthMode } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { Profile, Role } from "@/lib/types";
import { clearLocalAuthRole, readLocalAuthRole, writeLocalAuthRole } from "@/lib/localAuthSession";

type SignUpInput = { role: Role; name: string; email: string; password: string; organisationName?: string };
type AuthValue = {
  profile: Profile | null;
  token: string | null;
  loading: boolean;
  signIn: (role: Role, email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (localAuthMode) {
      let active = true;
      void readLocalAuthRole().then(async (role) => {
        if (!active || !role) return;
        const nextToken = `dev:${profileForId(role)}`;
        try {
          const nextProfile = await api.profile(role, nextToken);
          if (active) { setToken(nextToken); setProfile(nextProfile); }
        } catch {
          await clearLocalAuthRole();
        }
      }).finally(() => {
        if (active) setLoading(false);
      });
      return () => { active = false; };
    }
    if (demoMode || !supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const nextToken = data.session?.access_token ?? null;
      setToken(nextToken);
      if (nextToken) {
        try { setProfile(await api.profile("volunteer", nextToken)); } catch { setProfile(null); }
      } else {
        setProfile(null);
      }
    }).catch(() => {
      if (active) { setProfile(null); setToken(null); }
    }).finally(() => {
      if (active) setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      setToken(session?.access_token ?? null);
      if (event === "SIGNED_OUT" || !session) setProfile(null);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  const value = useMemo<AuthValue>(() => ({
    profile, token, loading,
    async signIn(role, email, password) {
      if (demoMode || localAuthMode) {
        const nextToken = `dev:${profileForId(role)}`;
        setToken(nextToken);
        setProfile(await api.profile(role, nextToken));
        if (localAuthMode) await writeLocalAuthRole(role);
        return;
      }
      if (apiConfigurationError) throw new Error(apiConfigurationError);
      if (!supabase) throw new Error(missingSupabaseMessage);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setToken(data.session.access_token);
      const next = await api.profile(role, data.session.access_token);
      if (next.role !== role) throw new Error(`This account is registered as a ${next.role}.`);
      setProfile(next);
    },
    async signUp(input) {
      if (demoMode || localAuthMode) {
        const nextToken = `dev:${profileForId(input.role)}`;
        setToken(nextToken);
        setProfile(
          localAuthMode
            ? await api.profile(input.role, nextToken)
            : await api.createProfile(
                {
                  role: input.role,
                  display_name: input.name,
                  email: input.email,
                  organisation_name: input.organisationName,
                },
                nextToken,
              ),
        );
        if (localAuthMode) await writeLocalAuthRole(input.role);
        return;
      }
      if (apiConfigurationError) throw new Error(apiConfigurationError);
      if (!supabase) throw new Error(missingSupabaseMessage);
      const { data, error } = await supabase.auth.signUp({ email: input.email, password: input.password });
      if (error) throw error;
      if (!data.session) throw new Error("Check your email to verify your account, then sign in.");
      setToken(data.session.access_token);
      setProfile(await api.createProfile({ role: input.role, display_name: input.name, email: input.email, organisation_name: input.organisationName }, data.session.access_token));
    },
    async signOut() {
      // Clear local state before any network work so navigation responds immediately.
      setProfile(null);
      setToken(null);
      if (localAuthMode) await clearLocalAuthRole();
      if (!demoMode && !localAuthMode && supabase) {
        const { error } = await supabase.auth.signOut({ scope: "local" });
        if (error) console.warn("Supabase local sign-out failed", error.message);
      }
    },
    async refreshProfile() {
      if (profile) setProfile(await api.profile(profile.role, token));
    },
  }), [loading, profile, token]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const profileForId = (role: Role) => role === "volunteer" ? "00000000-0000-4000-8000-000000000020" : "00000000-0000-4000-8000-000000000010";
const missingSupabaseMessage = "Connected mode is enabled, but Supabase Auth is missing. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, or set EXPO_PUBLIC_LOCAL_AUTH=true for local development, then restart Expo with --clear.";

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
