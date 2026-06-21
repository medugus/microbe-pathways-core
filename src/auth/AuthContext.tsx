// Auth context — listens to Supabase auth state and exposes the current
// session, profile (tenant binding), and roles to the React tree.
//
// Hard rules:
//  - onAuthStateChange listener is set up BEFORE getSession() (Supabase guidance).
//  - Roles come from the user_roles table, never from profile metadata.
//  - All gating (tenant scope, RLS) is enforced server-side; this context is
//    only for UI and route-guard use.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { installServerFnAuth } from "./installServerFnAuth";
import { isPrelaunchNoAuthEnabled, PRELAUNCH_TENANT_ID, PRELAUNCH_USER_ID } from "./prelaunch";

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

const prelaunchUser = {
  id: PRELAUNCH_USER_ID,
  email: "prelaunch@medugu.local",
} as User;

const prelaunchSession = {
  access_token: "prelaunch-local-session",
  refresh_token: "prelaunch-local-session",
  expires_in: 60 * 60 * 24 * 365,
  token_type: "bearer",
  user: prelaunchUser,
} as Session;

const prelaunchProfile: ProfileRow = {
  id: PRELAUNCH_USER_ID,
  tenant_id: PRELAUNCH_TENANT_ID,
  display_name: "Prelaunch Admin",
  email: "prelaunch@medugu.local",
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const prelaunchNoAuth = isPrelaunchNoAuthEnabled();
  const [session, setSession] = useState<Session | null>(prelaunchNoAuth ? prelaunchSession : null);
  const [profile, setProfile] = useState<ProfileRow | null>(
    prelaunchNoAuth ? prelaunchProfile : null,
  );
  const [roles, setRoles] = useState<AppRole[]>(
    prelaunchNoAuth
      ? ["admin", "consultant", "microbiologist", "lab_tech", "ipc", "ams_pharmacist"]
      : [],
  );
  const [loading, setLoading] = useState(!prelaunchNoAuth);

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
    if (prelaunchNoAuth) return;
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
  }, [prelaunchNoAuth]);

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
        if (prelaunchNoAuth) return;
        await supabase.auth.signOut();
      },
      refresh: async () => {
        if (prelaunchNoAuth) return;
        if (session?.user) await loadProfileAndRoles(session.user.id);
      },
    }),
    [loading, session, profile, roles, prelaunchNoAuth],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
