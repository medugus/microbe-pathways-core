// Client-side auth gate. Renders children only when authenticated.
// While Supabase is restoring the session it shows a neutral splash so the
// guarded UI never flashes. Unauthenticated users are sent to /login with a
// redirect-back search param.

import { useEffect, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "./AuthContext";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, session } = useAuth();
  const navigate = useNavigate();
  const location = useRouterState({ select: (s) => s.location });

  useEffect(() => {
    if (loading) return;
    if (session) return;
    // Don't push a redirect back to /login or /signup — would loop.
    const target = location.pathname;
    if (target.startsWith("/login") || target.startsWith("/signup")) return;
    void navigate({
      to: "/login",
      search: { redirect: target },
      replace: true,
    });
  }, [loading, session, navigate, location.pathname]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return <>{children}</>;
}
