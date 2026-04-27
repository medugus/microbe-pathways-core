// Workflow state machine — framework-agnostic.
// Phase-2 correction: Validation → Released requires releaseAllowed === true,
// and consultant-required pathways must have consultantApproval before release.

import type { Accession, AuditEvent } from "../domain/types";
import { WorkflowStage } from "../domain/enums";
import { newId } from "../domain/ids";
import { runValidation } from "./validationEngine";

export const WORKFLOW_TRACK: WorkflowStage[] = [
  WorkflowStage.Registered,
  WorkflowStage.SpecimenReceived,
  WorkflowStage.Microscopy,
  WorkflowStage.Culture,
  WorkflowStage.Isolate,
  WorkflowStage.AST,
  WorkflowStage.Stewardship,
  WorkflowStage.IPC,
  WorkflowStage.Validation,
  WorkflowStage.Released,
];

const FORWARD: Record<string, WorkflowStage[]> = {
  [WorkflowStage.Registered]: [WorkflowStage.SpecimenReceived],
  [WorkflowStage.SpecimenReceived]: [WorkflowStage.Microscopy, WorkflowStage.Culture],
  [WorkflowStage.Microscopy]: [WorkflowStage.Culture, WorkflowStage.Isolate],
  [WorkflowStage.Culture]: [WorkflowStage.Isolate, WorkflowStage.Validation],
  [WorkflowStage.Isolate]: [WorkflowStage.AST, WorkflowStage.Validation],
  [WorkflowStage.AST]: [WorkflowStage.Stewardship, WorkflowStage.Validation],
  [WorkflowStage.Stewardship]: [WorkflowStage.IPC, WorkflowStage.Validation],
  [WorkflowStage.IPC]: [WorkflowStage.Validation],
  [WorkflowStage.Validation]: [WorkflowStage.Released],
  [WorkflowStage.Released]: [],
};

export interface TransitionResult {
  ok: boolean;
  reason?: string;
  audit?: AuditEvent;
}

export function canTransition(from: WorkflowStage, to: WorkflowStage): boolean {
  if (from === to) return false;
  return (FORWARD[from] ?? []).includes(to);
}

/**
 * Completeness-aware transition. Rejects forbidden transitions AND blocks
 * Validation → Released unless validation passes (releaseAllowed === true).
 */
export function transition(
  accession: Accession,
  to: WorkflowStage,
  actor = "local",
  reason?: string,
): TransitionResult {
  const from = accession.workflowStatus;
  if (!canTransition(from, to)) {
    const audit: AuditEvent = {
      id: newId("aud"),
      at: new Date().toISOString(),
      actor,
      action: "workflow.transition.blocked",
      section: "workflow",
      field: "workflowStatus",
      oldValue: from,
      newValue: to,
      reason: `Transition ${from} → ${to} not allowed by state map.`,
    };
    return { ok: false, reason: audit.reason, audit };
  }

  // Gate Validation → Released on full validation result.
  if (from === WorkflowStage.Validation && to === WorkflowStage.Released) {
    const v = runValidation(accession);
    if (!v.releaseAllowed) {
      const audit: AuditEvent = {
        id: newId("aud"),
        at: new Date().toISOString(),
        actor,
        action: "workflow.transition.blocked",
        section: "workflow",
        field: "workflowStatus",
        oldValue: from,
        newValue: to,
        reason: `Release blocked by ${v.blockers.length} blocker(s): ${v.blockers.map((b) => b.code).join(", ")}.`,
      };
      return { ok: false, reason: audit.reason, audit };
    }
  }

  const audit: AuditEvent = {
    id: newId("aud"),
    at: new Date().toISOString(),
    actor,
    action: "workflow.transition",
    section: "workflow",
    field: "workflowStatus",
    oldValue: from,
    newValue: to,
    reason,
  };
  return { ok: true, audit };
}

export function nextSuggested(stage: WorkflowStage): WorkflowStage | undefined {
  return FORWARD[stage]?.[0];
}
