// Cloud audit writer — durable, tenant-scoped audit trail.
//
// Engines and the store call recordAudit() for every governance-relevant
// action. Writes go to public.audit_event with RLS enforcing tenant isolation.
// All writes are best-effort and non-blocking: a failed audit insert MUST NOT
// break the user-facing workflow (we log to console instead).
//
// The local in-memory Accession.audit array is preserved as a session view
// so the UI keeps working offline; Postgres remains the source of truth.

import { supabase } from "@/integrations/supabase/client";

let activeTenantId: string | null = null;
let activeActorLabel: string | null = null;

export function setAuditContext(opts: { tenantId: string | null; actorLabel?: string | null }) {
  activeTenantId = opts.tenantId;
  activeActorLabel = opts.actorLabel ?? null;
}

export function getAuditTenantId(): string | null {
  return activeTenantId;
}

export interface AuditWrite {
  action: string;
  entity:
    | "accession"
    | "isolate"
    | "ast"
    | "release_package"
    | "workflow"
    | "ipc"
    | "stewardship"
    | "report";
  entityId?: string | null;
  field?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
  /** Override the cached actor label (e.g. "consultant:Dr. X"). */
  actorLabel?: string | null;
}

export async function recordAudit(ev: AuditWrite): Promise<void> {
  if (!activeTenantId) return; // pre-hydration / signed out
  try {
    const userRes = await supabase.auth.getUser();
    const userId = userRes.data.user?.id ?? null;
    const { error } = await supabase.from("audit_event").insert({
      tenant_id: activeTenantId,
      actor_user_id: userId,
      actor_label: ev.actorLabel ?? activeActorLabel,
      action: ev.action,
      entity: ev.entity,
      entity_id: ev.entityId ?? null,
      field: ev.field ?? null,
      old_value: (ev.oldValue ?? null) as never,
      new_value: (ev.newValue ?? null) as never,
      reason: ev.reason ?? null,
    } as never);
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[medugu] audit write failed", ev.action, error.message);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[medugu] audit write threw", ev.action, err);
  }
}

/** Fire-and-forget convenience — never awaits, never throws. */
export function recordAuditAsync(ev: AuditWrite): void {
  void recordAudit(ev);
}
