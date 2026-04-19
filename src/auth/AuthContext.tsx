// Auth context — listens to Supabase auth state and exposes the current
// session, profile (tenant binding), and roles to the React tree.
//
// Hard rules:
//  - onAuthStateChange listener is set up BEFORE getSession() (Supabase guidance).
//  - Roles come from the user_roles table, never from profile metadata.
//  - All gating (tenant scope, RLS) is enforced server-side; this context is
//    only for UI and route-guard use.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { installServerFnAuth } from "./installServerFnAuth";

export type AppRole =
  | "lab_tech"
  | "microbiologist"
  | "consultant"
  | "ams_pharmacist"
  | "ipc"
  | "admin";

export interface ProfileRow {
  id: string;
  tenant_id: string;
  display_name: string | null;
  email: string | null;
}

export interface AuthState {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
  tenantId: string | null;
  roles: AppRole[];
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  // Load profile + roles for the current user
  const loadProfileAndRoles = async (userId: string) => {
    const [{ data: prof }, { data: roleRows }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, tenant_id, display_name, email")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    setProfile((prof as ProfileRow | null) ?? null);
    setRoles(((roleRows ?? []) as { role: AppRole }[]).map((r) => r.role));
  };

  useEffect(() => {
    installServerFnAuth();
    // 1) Subscribe FIRST (Supabase guidance) — never miss an event.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        // Defer profile fetch to avoid deadlocks inside the callback.
        setTimeout(() => {
          void loadProfileAndRoles(nextSession.user.id);
        }, 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    // 2) Then read existing session.
    void supabase.auth.getSession().then(async ({ data: { session: existing } }) => {
      setSession(existing);
      if (existing?.user) {
        await loadProfileAndRoles(existing.user.id);
      }
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      profile,
      tenantId: profile?.tenant_id ?? null,
      roles,
      hasRole: (r) => roles.includes(r),
      hasAnyRole: (rs) => rs.some((r) => roles.includes(r)),
      signOut: async () => {
        await supabase.auth.signOut();
      },
      refresh: async () => {
        if (session?.user) await loadProfileAndRoles(session.user.id);
      },
    }),
    [loading, session, profile, roles],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
