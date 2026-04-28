// Client-side auth gate. Renders children only when authenticated.
// While Supabase is restoring the session it shows a neutral splash so the
// guarded UI never flashes. Unauthenticated users are sent to /login with a
// redirect-back search param.

import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "./AuthContext";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, session } = useAuth();
  const navigate = useNavigate();
  const location = useRouterState({ select: (s) => s.location });

  // Avoid SSR/CSR hydration mismatch: render nothing on the server and on the
  // first client render. Auth state is only known in the browser, so any
  // server-rendered placeholder will diverge from the client tree.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

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

  if (!hydrated) return null;

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return <>{children}</>;
}
