// Config promotion store — browser-phase only.
//
// Mirrors the lightweight pub/sub pattern used by accessionStore. Holds the
// active config set, the editable draft, and full version history. All state
// transitions are pure functions in logic/configEngine.ts; this store is just
// the persistence + subscription shell.
//
// A future backend-owned config service can replace this module without
// changing the engine or any UI consumer.

import { useSyncExternalStore } from "react";
import {
  ConfigSection,
  ConfigSetPayload,
  ConfigState,
  PromoteInput,
  RollbackInput,
  promoteDraft,
  rollbackToVersion,
  resetDraftToActive,
  seedConfigState,
  updateDraftSection,
  clonePayload,
} from "../logic/configEngine";
import { loadConfigState, saveConfigState } from "./configPersistence";

type Listener = () => void;

function buildInitialState(): ConfigState {
  const persisted = loadConfigState();
  if (persisted) return persisted;
  return seedConfigState();
}

let state: ConfigState = buildInitialState();
const listeners = new Set<Listener>();

function emit() {
  saveConfigState(state);
  for (const l of listeners) l();
}

export const configStore = {
  getState(): ConfigState {
    return state;
  },
  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },

  /** Replace one section of the working draft. */
  updateDraftSection<K extends ConfigSection>(section: K, next: ConfigSetPayload[K]) {
    state = updateDraftSection(state, section, next);
    emit();
  },

  /** Throw away unsaved draft edits. */
  resetDraft() {
    state = resetDraftToActive(state);
    emit();
  },

  /** Promote draft → new active version; archive prior active to history. */
  promote(input: PromoteInput) {
    state = promoteDraft(state, input);
    emit();
  },

  /** Restore a prior active version as a new active entry. */
  rollback(input: RollbackInput) {
    state = rollbackToVersion(state, input);
    emit();
  },

  /** Re-seed from code defaults. Browser-phase recovery only. */
  resetToSeed() {
    state = seedConfigState();
    emit();
  },

  /**
   * Read-only accessor for the currently active payload. Engines that need
   * config data should funnel through here so a future backend can swap in.
   */
  getActivePayload(): ConfigSetPayload {
    return clonePayload(state.active.payload);
  },

  getActiveVersion(): number {
    return state.active.meta.version;
  },
};

export function useConfigState(): ConfigState {
  return useSyncExternalStore(
    configStore.subscribe,
    configStore.getState,
    configStore.getState,
  );
}
