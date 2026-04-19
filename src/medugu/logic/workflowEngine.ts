// Workflow state machine — framework-agnostic.
//
// Phase-2 states extend the contract WorkflowStage but are normalised here
// so transitions are explicit and audit-friendly.

import type { Accession, AuditEvent } from "../domain/types";
import { WorkflowStage } from "../domain/enums";
import { newId } from "../domain/ids";

/**
 * Phase-2 ordered workflow track. Maps to contract WorkflowStage but keeps
 * the ordered "draft → in_review → validated → release_ready → released"
 * spine the PRD requires for Phase 2 governance.
 */
export const WORKFLOW_TRACK: WorkflowStage[] = [
  WorkflowStage.Registered,        // draft
  WorkflowStage.SpecimenReceived,
  WorkflowStage.Microscopy,
  WorkflowStage.Culture,
  WorkflowStage.Isolate,
  WorkflowStage.AST,
  WorkflowStage.Validation,        // in_review
  WorkflowStage.Released,          // release_ready → released after release action
];

const FORWARD: Record<string, WorkflowStage[]> = {
  [WorkflowStage.Registered]:        [WorkflowStage.SpecimenReceived],
  [WorkflowStage.SpecimenReceived]:  [WorkflowStage.Microscopy, WorkflowStage.Culture],
  [WorkflowStage.Microscopy]:        [WorkflowStage.Culture, WorkflowStage.Isolate],
  [WorkflowStage.Culture]:           [WorkflowStage.Isolate, WorkflowStage.Validation],
  [WorkflowStage.Isolate]:           [WorkflowStage.AST, WorkflowStage.Validation],
  [WorkflowStage.AST]:               [WorkflowStage.Stewardship, WorkflowStage.Validation],
  [WorkflowStage.Stewardship]:       [WorkflowStage.IPC, WorkflowStage.Validation],
  [WorkflowStage.IPC]:               [WorkflowStage.Validation],
  [WorkflowStage.Validation]:        [WorkflowStage.Released],
  [WorkflowStage.Released]:          [],
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

export function transition(
  accession: Accession,
  to: WorkflowStage,
  actor = "local",
  reason?: string,
): TransitionResult {
  const from = accession.workflowStatus;
  if (!canTransition(from, to)) {
    return { ok: false, reason: `Transition ${from} → ${to} not allowed` };
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
