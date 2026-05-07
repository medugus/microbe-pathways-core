// Cloud sync adapter for AMS approvals.
//
// The in-memory accession.amsApprovals[] remains the working copy that engines
// and UI read from. This adapter mirrors every request / decision / expiry /
// escalation into the normalised `ams_approvals` Postgres table so that:
//   - tenant-wide queues, dashboards and governance can query rows directly
//   - server-side triggers enforce status transitions and immutability
//   - the audit trail captures every state change with auth.uid()
//
// All writes are best-effort and non-blocking. A failed mirror MUST NOT break
// the user-facing workflow — we log to console instead. The local blob keeps
// the UI working offline; Postgres remains the system of record for governance.

import { supabase } from "@/integrations/supabase/client";
import type { AMSApprovalRequest, AMSDenialReasonCode } from "../domain/types";

async function findAccessionRowId(
  tenantId: string,
  accessionNumber: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("accessions")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("accession_code", accessionNumber)
    .maybeSingle();
  if (error) {
    // eslint-disable-next-line no-console
    console.warn("[medugu] AMS mirror: accession lookup failed", error);
    return null;
  }
  return (data?.id as string | undefined) ?? null;
}

export async function pushAMSRequest(
  tenantId: string,
  accessionNumber: string,
  req: AMSApprovalRequest,
): Promise<void> {
  const accessionRowId = await findAccessionRowId(tenantId, accessionNumber);
  if (!accessionRowId) return;
  const userRes = await supabase.auth.getUser();
  const userId = userRes.data.user?.id ?? null;

  const { error } = await supabase.from("ams_approvals").insert({
    id: req.id,
    tenant_id: tenantId,
    accession_id: accessionRowId,
    ast_id: req.astId,
    isolate_id: req.isolateId,
    antibiotic_code: req.antibioticCode,
    status: "pending",
    due_by: req.dueBy ?? null,
    clinical_justification: req.clinicalJustification ?? null,
    requested_at: req.requested?.at ?? new Date().toISOString(),
    requested_by: userId,
    requested_role: req.requested?.actorRole ?? null,
    requested_note: req.requested?.note ?? null,
  });
  if (error && error.code !== "23505") {
    // eslint-disable-next-line no-console
    console.warn("[medugu] AMS mirror: request insert failed", error);
  }
}

export async function pushAMSDecision(
  tenantId: string,
  requestId: string,
  decision: {
    status: "approved" | "denied";
    actorRole?: string | null;
    note?: string;
    denialReasonCode?: AMSDenialReasonCode;
  },
): Promise<void> {
  const { error } = await supabase
    .from("ams_approvals")
    .update({
      status: decision.status,
      decided_role: decision.actorRole ?? null,
      decided_note: decision.note ?? null,
      denial_reason_code:
        decision.status === "denied" ? decision.denialReasonCode ?? null : null,
    })
    .eq("id", requestId)
    .eq("tenant_id", tenantId);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn("[medugu] AMS mirror: decision update failed", error);
  }
}

export async function pushAMSExpiry(
  tenantId: string,
  requestId: string,
): Promise<void> {
  const { error } = await supabase
    .from("ams_approvals")
    .update({ status: "expired" })
    .eq("id", requestId)
    .eq("tenant_id", tenantId);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn("[medugu] AMS mirror: expiry update failed", error);
  }
}

export async function pushAMSEscalation(
  tenantId: string,
  requestId: string,
): Promise<void> {
  const { error } = await supabase
    .from("ams_approvals")
    .update({ escalated: true, escalated_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("tenant_id", tenantId);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn("[medugu] AMS mirror: escalation update failed", error);
  }
}
