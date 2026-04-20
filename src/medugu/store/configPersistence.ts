// localStorage adapter for the Stage 7 config promotion store.
// Browser-phase only — single key, single editor.

import type { ConfigState } from "../logic/configEngine";

export const CONFIG_STORAGE_KEY = "medugu.v3.config";
export const CONFIG_SCHEMA_VERSION = 1;

export function loadConfigState(): ConfigState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConfigState;
    if (parsed.schemaVersion !== CONFIG_SCHEMA_VERSION) return null;
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
