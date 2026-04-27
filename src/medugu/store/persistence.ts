// localStorage adapter. Swap with IndexedDB/remote later without touching the store.

import type { MeduguState } from "../domain/types";

export const STORAGE_KEY = "medugu.v3.state";
// Bumped to 3 for Phase 2 workflow core (AST governance/cascade/standard,
// isolate significance + colony count, release package shape stable).
export const SCHEMA_VERSION = 5;

function isValidMeduguState(input: unknown): input is MeduguState {
  if (!input || typeof input !== "object") return false;
  const state = input as Partial<MeduguState>;
  if (state.schemaVersion !== SCHEMA_VERSION) return false;
  if (!state.accessions || typeof state.accessions !== "object") return false;
  if (!Array.isArray(state.accessionOrder)) return false;
  if (state.activeAccessionId !== null && typeof state.activeAccessionId !== "string") return false;
  if (!state.ruleVersion || typeof state.ruleVersion !== "object") return false;
  if (typeof state.ruleVersion.version !== "string") return false;
  if (typeof state.breakpointVersion !== "string") return false;
  if (typeof state.exportVersion !== "string") return false;
  if (typeof state.buildVersion !== "string") return false;
  return true;
}

export function loadState(): MeduguState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isValidMeduguState(parsed)) {
      window.localStorage.removeItem(STORAGE_KEY);
      console.warn("[medugu] dropped incompatible cached state from localStorage");
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveState(state: MeduguState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota or serialization error — swallow in single-user phase.
  }
}

export function clearState(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
