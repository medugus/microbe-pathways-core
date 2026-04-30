// Framework-agnostic central store. Tiny pub/sub, no external deps.
// React binding lives in useAccessionStore.ts.

import type {
  Accession,
  AMSApprovalRequest,
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
import { hydrateFromCloud, pushAccession } from "./cloudSync";
import { recordAuditAsync, setAuditContext } from "./cloudAudit";
import { evaluateCascadeForAccession } from "../logic/cascadeEngine";

type Listener = () => void;

function emptyState(): MeduguState {
  return {
    schemaVersion: SCHEMA_VERSION,
    accessions: {},
    accessionOrder: [],
    activeAccessionId: null,
    ruleVersion: RULE_VERSION,
    breakpointVersion: BREAKPOINT_VERSION,
    exportVersion: EXPORT_VERSION,
    buildVersion: BUILD_VERSION,
  };
}

function freshSeedState(): MeduguState {
  const accessions: Record<string, Accession> = {};
  const order: string[] = [];
  for (const a of DEMO_ACCESSIONS) {
    accessions[a.id] = a;
    order.push(a.id);
  }
  return {
    ...emptyState(),
    accessions,
    accessionOrder: order,
    activeAccessionId: order[0] ?? null,
  };
}

function buildInitialState(): MeduguState {
  // Browser cache only — Postgres is the source of truth and fills in via
  // hydrateFromTenant() once the user is authenticated.
  const persisted = loadState();
  if (persisted) return persisted;
  return emptyState();
}

let state: MeduguState = buildInitialState();
const listeners = new Set<Listener>();

// Cloud push state — debounced per-accession to avoid hammering Postgres
// on rapid edits in the same section.
let activeTenantId: string | null = null;
const pushTimers = new Map<string, ReturnType<typeof setTimeout>>();
const PUSH_DEBOUNCE_MS = 400;

function schedulePush(accessionId: string) {
  if (!activeTenantId) return;
  const tenantId = activeTenantId;
  const existing = pushTimers.get(accessionId);
  if (existing) clearTimeout(existing);
  pushTimers.set(
    accessionId,
    setTimeout(() => {
      pushTimers.delete(accessionId);
      const a = state.accessions[accessionId];
      if (!a) return;
      void pushAccession(tenantId, a).catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[medugu] cloud push failed", a.accessionNumber, err);
      });
    }, PUSH_DEBOUNCE_MS),
  );
}

function emit(changedAccessionIds: string[] = []) {
  saveState(state);
  for (const id of changedAccessionIds) schedulePush(id);
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
  emit([id]);
}

function appendAudit(
  a: Accession,
  ev: Omit<AuditEvent, "id" | "at">,
  cloud?: { entity: Parameters<typeof recordAuditAsync>[0]["entity"]; entityId?: string | null },
): Accession {
  // Fire-and-forget durable audit write (RLS-scoped to current tenant).
  recordAuditAsync({
    action: ev.action,
    entity: cloud?.entity ?? "accession",
    entityId: cloud?.entityId ?? a.id,
    field: ev.field ?? null,
    oldValue: ev.oldValue,
    newValue: ev.newValue,
    reason: ev.reason ?? null,
    actorLabel: ev.actor ?? null,
  });
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
    emit([a.id]);
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
    // Re-seed locally; cloudSync will push each one back to Postgres.
    state = freshSeedState();
    emit(state.accessionOrder);
  },

  /**
   * Cloud hydration entrypoint. Called once per signed-in session by the
   * <CloudHydrationGate>. Replaces local state with what RLS returns from
   * Postgres for the current tenant; if the tenant is empty, cloudSync seeds
   * it with the demo benchmark accessions and we re-read.
   */
  async hydrateFromTenant(tenantId: string, actorLabel?: string | null) {
    activeTenantId = tenantId;
    setAuditContext({ tenantId, actorLabel: actorLabel ?? null });
    const { accessions } = await hydrateFromCloud(tenantId);
    const map: Record<string, Accession> = {};
    const order: string[] = [];
    for (const a of accessions) {
      map[a.id] = a;
      order.push(a.id);
    }
    state = {
      ...state,
      accessions: map,
      accessionOrder: order,
      activeAccessionId: order[0] ?? null,
    };
    emit();
  },

  /** Detach from the current tenant (called on sign-out). */
  detachTenant() {
    activeTenantId = null;
    setAuditContext({ tenantId: null });
    for (const t of pushTimers.values()) clearTimeout(t);
    pushTimers.clear();
    state = emptyState();
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
        { entity: "isolate", entityId: iso.id },
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
        { entity: "isolate", entityId: isolateId },
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
        { entity: "isolate", entityId: isolateId },
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
        { entity: "ast", entityId: row.id },
      ),
    );
  },

  updateAST(accessionId: string, astId: string, patch: Partial<ASTResult>, actor = "local") {
    mutate(accessionId, (a) => {
      const before = a.ast.find((x) => x.id === astId);
      if (!before) return a;
      const after: ASTResult = { ...before, ...patch };
      let nextAccession: Accession = { ...a, ast: a.ast.map((x) => (x.id === astId ? after : x)) };
      // Live cascade re-evaluation: any raw/SIR change can flip a 2nd-line
      // drug's selective-reporting status. Pure logic — no audit write.
      const evals = evaluateCascadeForAccession(nextAccession);
      const merged: Record<string, Partial<ASTResult>> = {};
      for (const e of evals) {
        for (const [rid, p] of Object.entries(e.rowPatches)) {
          merged[rid] = { ...(merged[rid] ?? {}), ...p };
        }
      }
      if (Object.keys(merged).length > 0) {
        nextAccession = {
          ...nextAccession,
          ast: nextAccession.ast.map((r) => (merged[r.id] ? { ...r, ...merged[r.id] } : r)),
        };
      }
      return appendAudit(
        nextAccession,
        {
          actor,
          action: "ast.updated",
          section: "ast",
          field: `ast[${before.antibioticCode}]`,
          oldValue: before,
          newValue: after,
        },
        { entity: "ast", entityId: astId },
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
        { entity: "ast", entityId: astId },
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
    recordAuditAsync({
      action: audit.action,
      entity: "workflow",
      entityId: accessionId,
      field: audit.field ?? "workflowStatus",
      oldValue: audit.oldValue,
      newValue: audit.newValue,
      reason: audit.reason ?? null,
      actorLabel: audit.actor ?? null,
    });
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
        { entity: "release_package", entityId: accessionId },
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
        { entity: "release_package", entityId: accessionId },
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
        { entity: "release_package", entityId: accessionId },
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
        { entity: "ast", entityId: accessionId },
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
        { entity: "ast", entityId: astId },
      );
    });
  },

  // ---------- Stage 6: AMS restricted-drug approval (browser-phase) ----------

  requestAMSApproval(
    accessionId: string,
    req: AMSApprovalRequest,
    actor = "local",
  ) {
    mutate(accessionId, (a) => {
      const list = [...(a.amsApprovals ?? []), req];
      return appendAudit(
        { ...a, amsApprovals: list },
        {
          actor,
          action: "ams.requested",
          section: "stewardship",
          field: `amsApprovals[${req.antibioticCode}]`,
          newValue: {
            astId: req.astId,
            antibioticCode: req.antibioticCode,
            dueBy: req.dueBy,
            requestedBy: req.requested?.actor,
            note: req.requested?.note,
          },
        },
        { entity: "stewardship", entityId: req.id },
      );
    });
  },

  decideAMSApproval(
    accessionId: string,
    requestId: string,
    decision: { status: "approved" | "denied"; actor: string; note?: string },
  ) {
    mutate(accessionId, (a) => {
      const list = a.amsApprovals ?? [];
      const before = list.find((r) => r.id === requestId);
      if (!before) return a;
      const after: AMSApprovalRequest = {
        ...before,
        status: decision.status,
        decided: {
          at: new Date().toISOString(),
          actor: decision.actor,
          note: decision.note,
        },
      };
      return appendAudit(
        {
          ...a,
          amsApprovals: list.map((r) => (r.id === requestId ? after : r)),
        },
        {
          actor: decision.actor,
          action: decision.status === "approved" ? "ams.approved" : "ams.denied",
          section: "stewardship",
          field: `amsApprovals[${before.antibioticCode}]`,
          oldValue: { status: before.status },
          newValue: { status: after.status, note: decision.note },
          reason: decision.note,
        },
        { entity: "stewardship", entityId: requestId },
      );
    });
  },

  expireAMSApproval(
    accessionId: string,
    requestId: string,
    actor = "system",
  ) {
    mutate(accessionId, (a) => {
      const list = a.amsApprovals ?? [];
      const before = list.find((r) => r.id === requestId);
      if (!before || before.status !== "pending") return a;
      const after: AMSApprovalRequest = {
        ...before,
        status: "expired",
        expired: { at: new Date().toISOString(), actor },
      };
      return appendAudit(
        {
          ...a,
          amsApprovals: list.map((r) => (r.id === requestId ? after : r)),
        },
        {
          actor,
          action: "ams.expired",
          section: "stewardship",
          field: `amsApprovals[${before.antibioticCode}]`,
          oldValue: { status: before.status },
          newValue: { status: after.status },
        },
        { entity: "stewardship", entityId: requestId },
      );
    });
  },

  escalateAMSApproval(
    accessionId: string,
    requestId: string,
    actor = "system",
    note?: string,
  ) {
    mutate(accessionId, (a) => {
      const list = a.amsApprovals ?? [];
      const before = list.find((r) => r.id === requestId);
      if (!before || before.escalated) return a;
      const after: AMSApprovalRequest = { ...before, escalated: true };
      return appendAudit(
        {
          ...a,
          amsApprovals: list.map((r) => (r.id === requestId ? after : r)),
        },
        {
          actor,
          action: "ams.escalated",
          section: "stewardship",
          field: `amsApprovals[${before.antibioticCode}]`,
          newValue: { escalated: true },
          reason: note,
        },
        { entity: "stewardship", entityId: requestId },
      );
    });
  },
};
