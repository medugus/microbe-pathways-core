// Cloud audit writer — durable, tenant-scoped audit trail.
//
// Engines and the store call recordAudit() for every governance-relevant
// action. Writes go through public.append_audit_event(), which appends to the
// write-once public.audit_event log and lets Postgres compute the server-side
// payload hash / chain hash. If Supabase is unavailable, a signed local
// fallback copy is queued so the event is not silently lost.
//
// The local in-memory Accession.audit array is preserved as a session view
// so the UI keeps working offline; Postgres remains the source of truth.

import { supabase } from "@/integrations/supabase/client";
import { canonicalStringify } from "../utils/canonicalJson";

let activeTenantId: string | null = null;
let activeActorLabel: string | null = null;
const LOCAL_AUDIT_FALLBACK_KEY = "medugu:persistent-audit-fallback:v1";
const MAX_LOCAL_FALLBACK_EVENTS = 500;

export function setAuditContext(opts: {
  tenantId: string | null;
  actorLabel?: string | null;
}) {
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
    | "report"
    | "zone_reader";
  entityId?: string | null;
  accessionId?: string | null;
  field?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
  sourceModule?: "lims" | "release" | "ipc" | "ams" | "zone_reader" | "workflow";
  payload?: Record<string, unknown>;
  /** Override the cached actor label (e.g. "consultant:Dr. X"). */
  actorLabel?: string | null;
}

export interface SignedAuditPayload {
  payload: Record<string, unknown>;
  payloadHash: string;
}

export interface LocalAuditFallbackEvent extends SignedAuditPayload {
  queuedAt: string;
  tenantId: string | null;
  actorUserId: string | null;
  reason: string;
}

export async function sha256Hex(input: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto SHA-256 is unavailable in this runtime.");
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function inferSourceModule(ev: AuditWrite): NonNullable<AuditWrite["sourceModule"]> {
  if (ev.sourceModule) return ev.sourceModule;
  if (ev.entity === "zone_reader") return "zone_reader";
  if (ev.entity === "ipc") return "ipc";
  if (ev.entity === "stewardship") return "ams";
  if (ev.entity === "release_package") return "release";
  if (ev.entity === "workflow") return "workflow";
  return "lims";
}

export async function buildSignedAuditPayload(
  ev: AuditWrite,
  opts: {
    tenantId: string | null;
    actorUserId?: string | null;
    actorLabel?: string | null;
    at?: string;
  },
): Promise<SignedAuditPayload> {
  const sourceModule = inferSourceModule(ev);
  const payload: Record<string, unknown> = {
    eventType: ev.action,
    action: ev.action,
    entity: ev.entity,
    entityId: ev.entityId ?? null,
    accessionId: ev.accessionId ?? (ev.entity === "accession" ? ev.entityId ?? null : null),
    field: ev.field ?? null,
    oldValue: ev.oldValue ?? null,
    newValue: ev.newValue ?? null,
    reason: ev.reason ?? null,
    actorLabel: ev.actorLabel ?? opts.actorLabel ?? null,
    actorUserId: opts.actorUserId ?? null,
    tenantId: opts.tenantId,
    sourceModule,
    at: opts.at ?? new Date().toISOString(),
    ...(ev.payload ?? {}),
  };

  return {
    payload,
    payloadHash: await sha256Hex(canonicalStringify(payload)),
  };
}

export function appendLocalAuditFallback(entry: LocalAuditFallbackEvent): void {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(LOCAL_AUDIT_FALLBACK_KEY);
    const existing = raw ? (JSON.parse(raw) as LocalAuditFallbackEvent[]) : [];
    const next = [...existing, entry].slice(-MAX_LOCAL_FALLBACK_EVENTS);
    localStorage.setItem(LOCAL_AUDIT_FALLBACK_KEY, JSON.stringify(next));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[medugu] local audit fallback write failed", err);
  }
}

export async function recordAudit(ev: AuditWrite): Promise<void> {
  let actorUserId: string | null = null;
  let signed: SignedAuditPayload | null = null;
  try {
    const userRes = await supabase.auth.getUser();
    actorUserId = userRes.data.user?.id ?? null;
    signed = await buildSignedAuditPayload(ev, {
      tenantId: activeTenantId,
      actorUserId,
      actorLabel: ev.actorLabel ?? activeActorLabel,
    });

    if (!activeTenantId) {
      throw new Error("Audit tenant context is not initialized.");
    }

    const { error } = await (supabase as any).rpc("append_audit_event", {
      p_action: ev.action,
      p_entity: ev.entity,
      p_entity_id: ev.entityId ?? null,
      p_accession_id: signed.payload.accessionId ?? null,
      p_field: ev.field ?? null,
      p_old_value: (ev.oldValue ?? null) as never,
      p_new_value: (ev.newValue ?? null) as never,
      p_reason: ev.reason ?? null,
      p_actor_label: ev.actorLabel ?? activeActorLabel,
      p_source_module: signed.payload.sourceModule,
      p_payload: signed.payload as never,
    });
    if (error) {
      throw new Error(error.message);
    }
  } catch (err) {
    if (!signed) {
      try {
        signed = await buildSignedAuditPayload(ev, {
          tenantId: activeTenantId,
          actorUserId,
          actorLabel: ev.actorLabel ?? activeActorLabel,
        });
      } catch {
        signed = null;
      }
    }
    if (signed) {
      appendLocalAuditFallback({
        ...signed,
        queuedAt: new Date().toISOString(),
        tenantId: activeTenantId,
        actorUserId,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
    // eslint-disable-next-line no-console
    console.warn("[medugu] audit write threw", ev.action, err);
  }
}

/** Fire-and-forget convenience — never awaits, never throws. */
export function recordAuditAsync(ev: AuditWrite): void {
  void recordAudit(ev);
}
