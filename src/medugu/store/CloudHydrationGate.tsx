// Cloud hydration gate. Renders a loading splash until the accession store
// has pulled the tenant's data from Postgres. Re-hydrates if the tenant
// changes (e.g. user switches accounts in the same tab) and detaches on
// sign-out so a stale cache doesn't leak between users.

import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/auth/AuthContext";
import { meduguActions } from "@/medugu/store/useAccessionStore";

export function CloudHydrationGate({ children }: { children: ReactNode }) {
  const { tenantId, user, profile } = useAuth();
  const [hydratedTenantId, setHydratedTenantId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) {
      meduguActions.detachTenant();
      setHydratedTenantId(null);
      return;
    }
    if (hydratedTenantId === tenantId) return;
    let cancelled = false;
    setError(null);
    const actorLabel = profile?.display_name ?? user?.email ?? null;
    meduguActions
      .hydrateFromTenant(tenantId, actorLabel)
      .then(() => {
        if (!cancelled) setHydratedTenantId(tenantId);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load lab data");
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId, hydratedTenantId, user?.id, profile?.display_name]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md text-center">
          <p className="text-sm font-medium text-destructive">Could not load lab data</p>
          <p className="mt-2 text-xs text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!tenantId || hydratedTenantId !== tenantId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading lab data…</div>
      </div>
    );
  }

  return <>{children}</>;
}
