// Tiny strip rendered above the existing AppShell so the operator always sees
// who is signed in, the active tenant, and granted roles. Sign-out lives here.
//
// This is purely UI — no business logic. The AppShell beneath remains untouched.

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function SessionBar() {
  const { profile, roles, user, signOut } = useAuth();
  const [tenantName, setTenantName] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.tenant_id) {
      setTenantName(null);
      return;
    }
    void supabase
      .from("tenants")
      .select("name")
      .eq("id", profile.tenant_id)
      .maybeSingle()
      .then(({ data }) => setTenantName((data?.name as string | undefined) ?? null));
  }, [profile?.tenant_id]);

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
        <span className="font-medium text-foreground">
          {profile?.display_name ?? user?.email ?? "Signed in"}
        </span>
        {tenantName && (
          <>
            <span>·</span>
            <span>{tenantName}</span>
          </>
        )}
        {roles.length > 0 && (
          <>
            <span>·</span>
            <span className="flex flex-wrap gap-1">
              {roles.map((r) => (
                <span
                  key={r}
                  className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-primary"
                >
                  {r}
                </span>
              ))}
            </span>
          </>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Link
          to="/audit"
          className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Audit
        </Link>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void signOut()}
          className="h-7 px-2 text-xs"
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}
