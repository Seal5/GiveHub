import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { api, demoMode } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { Profile, Role } from "@/lib/types";

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
    if (demoMode || !supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(async ({ data }) => {
      const nextToken = data.session?.access_token ?? null;
      setToken(nextToken);
      if (nextToken) {
        try { setProfile(await api.profile("volunteer", nextToken)); } catch { setProfile(null); }
      }
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setToken(session?.access_token ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthValue>(() => ({
    profile, token, loading,
    async signIn(role, email, password) {
      if (demoMode || !supabase) {
        setToken(`dev:${profileForId(role)}`);
        setProfile(await api.profile(role));
        return;
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setToken(data.session.access_token);
      const next = await api.profile(role, data.session.access_token);
      if (next.role !== role) throw new Error(`This account is registered as a ${next.role}.`);
      setProfile(next);
    },
    async signUp(input) {
      if (demoMode || !supabase) {
        setToken(`dev:${profileForId(input.role)}`);
        setProfile(await api.createProfile({ role: input.role, display_name: input.name, email: input.email, organisation_name: input.organisationName }));
        return;
      }
      const { data, error } = await supabase.auth.signUp({ email: input.email, password: input.password });
      if (error) throw error;
      if (!data.session) throw new Error("Check your email to verify your account, then sign in.");
      setToken(data.session.access_token);
      setProfile(await api.createProfile({ role: input.role, display_name: input.name, email: input.email, organisation_name: input.organisationName }, data.session.access_token));
    },
    async signOut() {
      if (supabase) await supabase.auth.signOut();
      setProfile(null); setToken(null);
    },
    async refreshProfile() {
      if (profile) setProfile(await api.profile(profile.role, token));
    },
  }), [loading, profile, token]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const profileForId = (role: Role) => role === "volunteer" ? "00000000-0000-4000-8000-000000000020" : "00000000-0000-4000-8000-000000000010";

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

