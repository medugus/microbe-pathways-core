// Framework-agnostic central store. Tiny pub/sub, no external deps.
// React binding lives in useAccessionStore.ts.
//
// This is the single source of truth for: calculations, live report preview,
// validation, release state, and exports. Logic modules read/write through
// this store; UI components only render its projections.

import type { Accession, MeduguState } from "../domain/types";
import { DEMO_ACCESSIONS } from "../seed/demoAccessions";
import {
  BUILD_VERSION,
  BREAKPOINT_VERSION,
  EXPORT_VERSION,
  RULE_VERSION,
} from "../domain/versions";
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
};
