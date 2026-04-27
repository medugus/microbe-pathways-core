// Framework-agnostic central store. Tiny pub/sub, no external deps.
// React binding lives in useAccessionStore.ts.

import type { Accession, MeduguState } from "../domain/types";
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
import { createAppendAudit } from "./audit";
import { createAccessionMutations } from "./accessionMutations";
import { createIsolateMutations } from "./isolateMutations";
import { createASTMutations } from "./astMutations";
import { createAMSMutations } from "./amsMutations";
import { createReleaseMutations } from "./releaseMutations";

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

const appendAudit = createAppendAudit(recordAuditAsync, newId);

const accessionMutations = createAccessionMutations(
  {
    getState: () => state,
    setState: (next) => {
      state = next;
    },
    emit,
  },
  {
    freshSeedState,
    emptyState,
    hydrateFromCloud,
    setAuditContext,
    setActiveTenantId: (tenantId) => {
      activeTenantId = tenantId;
    },
    clearPushTimers: () => {
      for (const t of pushTimers.values()) clearTimeout(t);
      pushTimers.clear();
    },
  },
);

const isolateMutations = createIsolateMutations(mutate, appendAudit);
const astMutations = createASTMutations(mutate, appendAudit);
const amsMutations = createAMSMutations(mutate, appendAudit);
const releaseMutations = createReleaseMutations(mutate, appendAudit, recordAuditAsync);

export const accessionStore = {
  getState(): MeduguState {
    return state;
  },
  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  ...accessionMutations,
  ...isolateMutations,
  ...astMutations,
  ...releaseMutations,
  ...amsMutations,
};
