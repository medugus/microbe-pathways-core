// localStorage adapter. Swap with IndexedDB/remote later without touching the store.

import type { MeduguState } from "../domain/types";

export const STORAGE_KEY = "medugu.v3.state";
// Bumped to 3 for Phase 2 workflow core (AST governance/cascade/standard,
// isolate significance + colony count, release package shape stable).
export const SCHEMA_VERSION = 3;

export function loadState(): MeduguState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MeduguState;
    if (parsed.schemaVersion !== SCHEMA_VERSION) return null;
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
