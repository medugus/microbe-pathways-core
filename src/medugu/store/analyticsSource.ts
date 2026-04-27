// Analytics source adapter — Stage 8 (browser-phase).
//
// Bridges currently-available local data into the AnalyticsInputs shape that
// analyticsEngine consumes. Two sources today:
//   1. Accessions from the in-memory accessionStore (already tenant-hydrated).
//   2. Recent audit_event + dispatch_history rows from Supabase (RLS-scoped).
//
// This adapter is the ONLY place that knows where data lives. A future
// backend-owned analytics service can replace it wholesale by exposing the
// same loadAnalyticsInputs() contract.
//
// Browser-phase scope: capped row counts, no pagination, no warehouse joins.

import { supabase } from "@/integrations/supabase/client";
import { accessionStore } from "./accessionStore";
import type { AnalyticsInputs, AuditRowLite, DispatchRowLite } from "../logic/analyticsEngine";

const AUDIT_LIMIT = 1000;
const DISPATCH_LIMIT = 1000;

export async function loadAnalyticsInputs(): Promise<AnalyticsInputs> {
  const state = accessionStore.getState();
  const accessions = state.accessionOrder
    .map((id) => state.accessions[id])
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  const [auditRes, dispatchRes] = await Promise.all([
    supabase
      .from("audit_event")
      .select("at, action, entity, entity_id")
      .order("at", { ascending: false })
      .limit(AUDIT_LIMIT),
    supabase
      .from("dispatch_history")
      .select(
        "requested_at, completed_at, status, format, receiver_name, attempt_no, parent_dispatch_id",
      )
      .order("requested_at", { ascending: false })
      .limit(DISPATCH_LIMIT),
  ]);

  const audit: AuditRowLite[] = (auditRes.data ?? []).map((r) => ({
    at: r.at as string,
    action: r.action as string,
    entity: r.entity as string,
    entityId: (r.entity_id as string | null) ?? null,
  }));

  const dispatches: DispatchRowLite[] = (dispatchRes.data ?? []).map((r) => ({
    requestedAt: r.requested_at as string,
    completedAt: (r.completed_at as string | null) ?? null,
    status: r.status as string,
    format: r.format as string,
    receiverName: r.receiver_name as string,
    attemptNo: (r.attempt_no as number) ?? 1,
    parentDispatchId: (r.parent_dispatch_id as string | null) ?? null,
  }));

  return { accessions, audit, dispatches, now: new Date() };
}
