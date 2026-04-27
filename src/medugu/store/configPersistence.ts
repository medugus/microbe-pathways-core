// localStorage adapter for the Stage 7 config promotion store.
// Browser-phase only — single key, single editor.

import type { ConfigState } from "../logic/configEngine";

export const CONFIG_STORAGE_KEY = "medugu.v3.config";
export const CONFIG_SCHEMA_VERSION = 1;

function isValidConfigState(input: unknown): input is ConfigState {
  if (!input || typeof input !== "object") return false;
  const state = input as Partial<ConfigState>;
  if (state.schemaVersion !== CONFIG_SCHEMA_VERSION) return false;
  if (!state.active || typeof state.active !== "object") return false;
  if (!state.active.meta || typeof state.active.meta !== "object") return false;
  if (typeof state.active.meta.version !== "number") return false;
  if (!state.active.payload || typeof state.active.payload !== "object") return false;
  if (!state.draft || typeof state.draft !== "object") return false;
  if (!Array.isArray(state.history)) return false;
  return true;
}

export function loadConfigState(): ConfigState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isValidConfigState(parsed)) {
      window.localStorage.removeItem(CONFIG_STORAGE_KEY);
      console.warn("[medugu] dropped incompatible cached config from localStorage");
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveConfigState(state: ConfigState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota or serialization error — swallow in browser-phase.
  }
}

export function clearConfigState(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CONFIG_STORAGE_KEY);
}
