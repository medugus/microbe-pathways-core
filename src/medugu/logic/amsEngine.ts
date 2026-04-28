// AMS approval engine — pure, framework-agnostic.
//
// Stage 6, browser-phase only:
// - actor identity is a manual placeholder
// - SLA is informational (no real timer / notification transport)
// - escalation flag is computed from clock, not delivered anywhere
// - production auth/role enforcement is NOT in scope here
//
// Contract: derive per-AST approval status, integrate with stewardship
// visibility, and surface a tenant-wide queue of pending requests.

import type {
  Accession,
  AMSApprovalRequest,
  AMSApprovalStatus,
  ASTResult,
} from "../domain/types";
import { AMS_POLICY } from "../config/amsConfig";
import { getStewardship } from "../config/stewardshipRules";

/** True when this AST row is governed by AMS approval (restricted release class). */
export function isRestrictedRow(row: ASTResult): boolean {
  const sw = getStewardship(row.antibioticCode);
  if (!sw) return false;
  return sw.defaultReleaseClass === "restricted";
}

/** Compute SLA dueBy for an antibiotic at the moment of request. */
export function computeDueBy(antibioticCode: string, requestedAtIso: string): string {
  const sw = getStewardship(antibioticCode);
  const hours =
    sw?.aware === "Reserve" ? AMS_POLICY.reserveSlaHours : AMS_POLICY.defaultSlaHours;
  return new Date(new Date(requestedAtIso).getTime() + hours * 3_600_000).toISOString();
}

/** Status of a row given the latest matching approval, or 'not_requested'. */
export function approvalStatusForRow(
  accession: Accession,
  astId: string,
): AMSApprovalStatus {
  const reqs = (accession.amsApprovals ?? []).filter((r) => r.astId === astId);
  if (reqs.length === 0) return "not_requested";
  // Newest by requested.at, falling back to id ordering.
  const latest = [...reqs].sort((a, b) =>
    (b.requested?.at ?? "").localeCompare(a.requested?.at ?? ""),
  )[0];
  return latest.status;
}

/** Latest approval request for an AST row, if any. */
export function latestApprovalForRow(
  accession: Accession,
  astId: string,
): AMSApprovalRequest | undefined {
  const reqs = (accession.amsApprovals ?? []).filter((r) => r.astId === astId);
  if (reqs.length === 0) return undefined;
  return [...reqs].sort((a, b) =>
    (b.requested?.at ?? "").localeCompare(a.requested?.at ?? ""),
  )[0];
}

/**
 * True when the row's restricted output is currently allowed to be visible to
 * clinicians / included in clinician-facing exports.
 *
 * Browser-phase rule:
 *   - Non-restricted rows: not governed here (stewardship engine decides).
 *   - Restricted rows: visible only when the latest approval is 'approved'.
 *   - 'denied' / 'expired' / 'pending' / 'not_requested' → hidden.
 */
export function restrictedRowReleaseAllowed(
  accession: Accession,
  row: ASTResult,
): boolean {
  if (!isRestrictedRow(row)) return true;
  return approvalStatusForRow(accession, row.id) === "approved";
}

export interface AMSQueueItem {
  request: AMSApprovalRequest;
  accessionId: string;
  accessionNumber: string;
  patientLabel: string;
  ward?: string;
  organismDisplay?: string;
  /** True when SLA has elapsed but no decision yet. */
  overdue: boolean;
  /** Hours until dueBy (negative if overdue). */
  hoursToDue: number | null;
}

/** Build a tenant-wide pending-approval queue from local accessions. */
export function buildAMSQueue(
  accessions: Record<string, Accession>,
  now: Date = new Date(),
): AMSQueueItem[] {
  const out: AMSQueueItem[] = [];
  for (const a of Object.values(accessions)) {
    const reqs = a.amsApprovals ?? [];
    for (const r of reqs) {
      if (r.status !== "pending") continue;
      const ast = a.ast.find((x) => x.id === r.astId);
      const iso = ast ? a.isolates.find((i) => i.id === ast.isolateId) : undefined;
      const hoursToDue = r.dueBy
        ? (new Date(r.dueBy).getTime() - now.getTime()) / 3_600_000
        : null;
      const overdue = hoursToDue !== null && hoursToDue < 0;
      out.push({
        request: r,
        accessionId: a.id,
        accessionNumber: a.accessionNumber,
        patientLabel:
          [a.patient.givenName, a.patient.familyName].filter(Boolean).join(" ") ||
          a.patient.mrn,
        ward: a.patient.ward,
        organismDisplay: iso?.organismDisplay,
        overdue,
        hoursToDue,
      });
    }
  }
  // Overdue first, then soonest-due.
  out.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    const ah = a.hoursToDue ?? Infinity;
    const bh = b.hoursToDue ?? Infinity;
    return ah - bh;
  });
  return out;
}

/**
 * Return ids of pending requests that have crossed the expiry grace window.
 * UI calls this on demand; nothing runs on a server timer in this stage.
 */
export function findExpirableRequestIds(
  accession: Accession,
  now: Date = new Date(),
): string[] {
  const out: string[] = [];
  for (const r of accession.amsApprovals ?? []) {
    if (r.status !== "pending" || !r.dueBy) continue;
    const ageHours = (now.getTime() - new Date(r.dueBy).getTime()) / 3_600_000;
    if (ageHours >= AMS_POLICY.expiryGraceHours) out.push(r.id);
  }
  return out;
}

/** True when accession has any pending restricted approvals. */
export function hasPendingApprovals(accession: Accession): boolean {
  return (accession.amsApprovals ?? []).some((r) => r.status === "pending");
}

/** Count of pending restricted rows that are blocking clinician release. */
export function pendingRestrictedRowCount(accession: Accession): number {
  let n = 0;
  for (const row of accession.ast) {
    if (!isRestrictedRow(row)) continue;
    if (approvalStatusForRow(accession, row.id) !== "approved") n += 1;
  }
  return n;
}
