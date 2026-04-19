// Framework-agnostic central store. Tiny pub/sub, no external deps.
// React binding lives in useAccessionStore.ts.

import type {
  Accession,
  ASTResult,
  AuditEvent,
  Isolate,
  MeduguState,
  PhoneOutEvent,
  ReleasePackage,
} from "../domain/types";
import type { WorkflowStage, ReleaseState } from "../domain/enums";
import { DEMO_ACCESSIONS } from "../seed/demoAccessions";
import {
  BUILD_VERSION,
  BREAKPOINT_VERSION,
  EXPORT_VERSION,
  RULE_VERSION,
} from "../domain/versions";
import { newId } from "../domain/ids";
import { loadState, saveState, SCHEMA_VERSION } from "./persistence";

type Listener = () => void;

function freshState(): MeduguState {
  const accessions: Record<string, Accession> = {};
  const order: string[] = [];
  for (const a of DEMO_ACCESSIONS) {
    accessions[a.id] = a;
    order.push(a.id);
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    accessions,
    accessionOrder: order,
    activeAccessionId: order[0] ?? null,
    ruleVersion: RULE_VERSION,
    breakpointVersion: BREAKPOINT_VERSION,
    exportVersion: EXPORT_VERSION,
    buildVersion: BUILD_VERSION,
  };
}

function buildInitialState(): MeduguState {
  const persisted = loadState();
  if (persisted) return persisted;
  return freshState();
}

let state: MeduguState = buildInitialState();
const listeners = new Set<Listener>();

function emit() {
  saveState(state);
  for (const l of listeners) l();
}

function mutate(id: string, fn: (a: Accession) => Accession) {
  const current = state.accessions[id];
  if (!current) return;
  const next = { ...fn(current), updatedAt: new Date().toISOString() };
  state = {
    ...state,
    accessions: { ...state.accessions, [id]: next },
  };
  emit();
}

function appendAudit(a: Accession, ev: Omit<AuditEvent, "id" | "at">): Accession {
  return {
    ...a,
    audit: [
      ...a.audit,
      { id: newId("aud"), at: new Date().toISOString(), ...ev },
    ],
  };
}

export const accessionStore = {
  getState(): MeduguState {
    return state;
  },
  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  setActive(id: string | null) {
    state = { ...state, activeAccessionId: id };
    emit();
  },
  upsertAccession(a: Accession) {
    const exists = !!state.accessions[a.id];
    state = {
      ...state,
      accessions: {
        ...state.accessions,
        [a.id]: { ...a, updatedAt: new Date().toISOString() },
      },
      accessionOrder: exists ? state.accessionOrder : [...state.accessionOrder, a.id],
    };
    emit();
  },
  removeAccession(id: string) {
    const next = { ...state.accessions };
    delete next[id];
    state = {
      ...state,
      accessions: next,
      accessionOrder: state.accessionOrder.filter((x) => x !== id),
      activeAccessionId: state.activeAccessionId === id ? null : state.activeAccessionId,
    };
    emit();
  },
  resetToSeed() {
    state = freshState();
    emit();
  },

  // ---------- Phase 2 mutations ----------

  addIsolate(accessionId: string, iso: Isolate, actor = "local") {
    mutate(accessionId, (a) =>
      appendAudit(
        { ...a, isolates: [...a.isolates, iso] },
        {
          actor,
          action: "isolate.added",
          section: "isolate",
          field: `isolates[${iso.isolateNo}]`,
          newValue: { organismCode: iso.organismCode, significance: iso.significance },
        },
      ),
    );
  },

  updateIsolate(accessionId: string, isolateId: string, patch: Partial<Isolate>, actor = "local") {
    mutate(accessionId, (a) => {
      const before = a.isolates.find((i) => i.id === isolateId);
      if (!before) return a;
      const after: Isolate = { ...before, ...patch };
      return appendAudit(
        { ...a, isolates: a.isolates.map((i) => (i.id === isolateId ? after : i)) },
        {
          actor,
          action: "isolate.updated",
          section: "isolate",
          field: `isolates[${before.isolateNo}]`,
          oldValue: before,
          newValue: after,
        },
      );
    });
  },

  removeIsolate(accessionId: string, isolateId: string, actor = "local") {
    mutate(accessionId, (a) => {
      const before = a.isolates.find((i) => i.id === isolateId);
      if (!before) return a;
      return appendAudit(
        {
          ...a,
          isolates: a.isolates.filter((i) => i.id !== isolateId),
          ast: a.ast.filter((x) => x.isolateId !== isolateId),
        },
        {
          actor,
          action: "isolate.removed",
          section: "isolate",
          field: `isolates[${before.isolateNo}]`,
          oldValue: before,
        },
      );
    });
  },

  addAST(accessionId: string, row: ASTResult, actor = "local") {
    mutate(accessionId, (a) =>
      appendAudit(
        { ...a, ast: [...a.ast, row] },
        {
          actor,
          action: "ast.added",
          section: "ast",
          field: `ast[${row.antibioticCode}]`,
          newValue: {
            isolateId: row.isolateId,
            antibioticCode: row.antibioticCode,
            method: row.method,
            standard: row.standard,
            rawValue: row.rawValue,
            interpretation: row.finalInterpretation,
          },
        },
      ),
    );
  },

  updateAST(accessionId: string, astId: string, patch: Partial<ASTResult>, actor = "local") {
    mutate(accessionId, (a) => {
      const before = a.ast.find((x) => x.id === astId);
      if (!before) return a;
      const after: ASTResult = { ...before, ...patch };
      return appendAudit(
        { ...a, ast: a.ast.map((x) => (x.id === astId ? after : x)) },
        {
          actor,
          action: "ast.updated",
          section: "ast",
          field: `ast[${before.antibioticCode}]`,
          oldValue: before,
          newValue: after,
        },
      );
    });
  },

  removeAST(accessionId: string, astId: string, actor = "local") {
    mutate(accessionId, (a) => {
      const before = a.ast.find((x) => x.id === astId);
      if (!before) return a;
      return appendAudit(
        { ...a, ast: a.ast.filter((x) => x.id !== astId) },
        {
          actor,
          action: "ast.removed",
          section: "ast",
          field: `ast[${before.antibioticCode}]`,
          oldValue: before,
        },
      );
    });
  },

  setWorkflowStage(accessionId: string, to: WorkflowStage, audit: AuditEvent) {
    mutate(accessionId, (a) => ({
      ...a,
      workflowStatus: to,
      stage: to,
      audit: [...a.audit, audit],
    }));
  },

  recordPhoneOut(accessionId: string, evt: PhoneOutEvent, actor = "local") {
    mutate(accessionId, (a) =>
      appendAudit(
        { ...a, phoneOuts: [...a.phoneOuts, evt] },
        {
          actor,
          action: "phoneOut.recorded",
          section: "release",
          field: "phoneOuts",
          newValue: { recipient: evt.recipient, reasonCode: evt.reasonCode, acknowledged: evt.acknowledged },
        },
      ),
    );
  },

  finaliseRelease(
    accessionId: string,
    pkg: ReleasePackage,
    nextState: ReleaseState,
    actor = "local",
  ) {
    mutate(accessionId, (a) =>
      appendAudit(
        {
          ...a,
          releasePackage: pkg,
          release: {
            ...a.release,
            state: nextState,
            releasedAt: new Date().toISOString(),
            releasedBy: actor,
            reportVersion: pkg.version,
          },
          releasedAt: new Date().toISOString(),
          releasingActor: actor,
        },
        {
          actor,
          action: "release.finalised",
          section: "release",
          field: "release.state",
          oldValue: a.release.state,
          newValue: nextState,
        },
      ),
    );
  },

  recordConsultantApproval(
    accessionId: string,
    approval: { approvedBy: string; reason?: string },
    actor = "local",
  ) {
    mutate(accessionId, (a) =>
      appendAudit(
        {
          ...a,
          release: {
            ...a.release,
            consultantApproval: {
              approvedBy: approval.approvedBy,
              approvedAt: new Date().toISOString(),
              reason: approval.reason,
            },
          },
        },
        {
          actor,
          action: "release.consultantApproved",
          section: "release",
          field: "release.consultantApproval",
          newValue: { approvedBy: approval.approvedBy, reason: approval.reason },
        },
      ),
    );
  },

  applyExpertRules(
    accessionId: string,
    rowPatches: Record<string, Partial<import("../domain/types").ASTResult>>,
    actor = "local",
  ) {
    mutate(accessionId, (a) => {
      const next = a.ast.map((r) => (rowPatches[r.id] ? { ...r, ...rowPatches[r.id] } : r));
      return appendAudit(
        { ...a, ast: next },
        {
          actor,
          action: "ast.expertRulesApplied",
          section: "ast",
          field: "ast",
          newValue: { affected: Object.keys(rowPatches).length },
        },
      );
    });
  },

  recordConsultantOverride(
    accessionId: string,
    astId: string,
    override: { actor: string; reason: string; toInterpretation?: import("../domain/enums").ASTInterpretation },
    actor = "local",
  ) {
    mutate(accessionId, (a) => {
      const before = a.ast.find((x) => x.id === astId);
      if (!before) return a;
      const after = {
        ...before,
        finalInterpretation: override.toInterpretation ?? before.finalInterpretation,
        consultantOverride: {
          actor: override.actor,
          at: new Date().toISOString(),
          reason: override.reason,
          fromInterpretation: before.finalInterpretation,
          toInterpretation: override.toInterpretation,
        },
      };
      return appendAudit(
        { ...a, ast: a.ast.map((x) => (x.id === astId ? after : x)) },
        {
          actor,
          action: "ast.consultantOverride",
          section: "ast",
          field: `ast[${before.antibioticCode}]`,
          oldValue: before.finalInterpretation,
          newValue: after.finalInterpretation,
          reason: override.reason,
        },
      );
    });
  },
};
