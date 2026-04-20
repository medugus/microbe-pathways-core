// Config promotion engine — Stage 7 (browser-phase).
//
// Framework-agnostic. No React, no localStorage, no network. Pure functions
// over a portable ConfigSet shape. The store layer (configStore.ts) is the
// only thing that persists; a future server-backed config service can replace
// the store without changing this engine or its UI contract.
//
// Browser-phase scope:
//   - single editor at a time (no multi-user merge)
//   - no server approval chain
//   - no signed promotions, no enterprise change-control
//   - actor identity is a free-text placeholder
//
// Lifecycle:
//   draft  → promote()  → active (new version), pushes prior active onto history
//   active → rollback() → restores a prior history entry as the new active
//                          (records the rollback as its own history entry)

import { ORGANISMS, type OrganismDef } from "../config/organisms";
import { ANTIBIOTICS, type AntibioticDef } from "../config/antibiotics";
import {
  MIC_BREAKPOINTS,
  DISK_BREAKPOINTS,
  type MICBreakpoint,
  type DiskBreakpoint,
} from "../config/breakpoints";
import { AB_STEWARDSHIP, type AntibioticStewardship } from "../config/stewardshipRules";
import { IPC_RULES, type IPCRule } from "../config/ipcRules";

// ---------- Portable shape ----------

export interface ConfigSetPayload {
  organisms: OrganismDef[];
  antibiotics: AntibioticDef[];
  micBreakpoints: MICBreakpoint[];
  diskBreakpoints: DiskBreakpoint[];
  stewardship: AntibioticStewardship[];
  ipcRules: IPCRule[];
}

export type ConfigSection = keyof ConfigSetPayload;

export const CONFIG_SECTIONS: { key: ConfigSection; label: string }[] = [
  { key: "organisms", label: "Organisms" },
  { key: "antibiotics", label: "Antibiotics" },
  { key: "micBreakpoints", label: "MIC breakpoints" },
  { key: "diskBreakpoints", label: "Disk breakpoints" },
  { key: "stewardship", label: "Stewardship rules" },
  { key: "ipcRules", label: "IPC rules" },
];

export interface ConfigVersionMeta {
  /** Monotonic integer; v1 is the seeded baseline. */
  version: number;
  /** ISO timestamp of promotion / rollback. */
  at: string;
  /** Free-text actor placeholder (browser-phase). */
  actor: string;
  /** Required note describing what changed or why rolled back. */
  note: string;
  /** "promote" for forward promotions, "rollback" when restoring a prior. */
  kind: "seed" | "promote" | "rollback";
  /** When kind=rollback, the version that was restored. */
  rolledBackTo?: number;
}

export interface ConfigVersion {
  meta: ConfigVersionMeta;
  payload: ConfigSetPayload;
}

export interface ConfigState {
  schemaVersion: number;
  /** Currently in-force config — propagates into release/export pins. */
  active: ConfigVersion;
  /** Working copy that admins edit before promotion. */
  draft: ConfigSetPayload;
  /**
   * History of every active version that ever existed (excluding the current
   * active). Newest entries first. Browser-phase only — never trimmed.
   */
  history: ConfigVersion[];
}

// ---------- Seeding ----------

/** Deep clone via JSON — payloads are pure data so this is safe. */
export function clonePayload(p: ConfigSetPayload): ConfigSetPayload {
  return JSON.parse(JSON.stringify(p)) as ConfigSetPayload;
}

export function seedPayloadFromCode(): ConfigSetPayload {
  return clonePayload({
    organisms: ORGANISMS,
    antibiotics: ANTIBIOTICS,
    micBreakpoints: MIC_BREAKPOINTS,
    diskBreakpoints: DISK_BREAKPOINTS,
    stewardship: AB_STEWARDSHIP,
    ipcRules: IPC_RULES,
  });
}

export function seedConfigState(): ConfigState {
  const payload = seedPayloadFromCode();
  return {
    schemaVersion: 1,
    active: {
      meta: {
        version: 1,
        at: new Date().toISOString(),
        actor: "system",
        note: "Initial seeded baseline from code defaults.",
        kind: "seed",
      },
      payload,
    },
    draft: clonePayload(payload),
    history: [],
  };
}

// ---------- Lifecycle ----------

export interface PromoteInput {
  actor: string;
  note: string;
}

export function promoteDraft(state: ConfigState, input: PromoteInput): ConfigState {
  const trimmedNote = input.note.trim();
  if (!trimmedNote) {
    throw new Error("Promotion note is required.");
  }
  const trimmedActor = input.actor.trim() || "local";
  const nextVersion = state.active.meta.version + 1;
  const newActive: ConfigVersion = {
    meta: {
      version: nextVersion,
      at: new Date().toISOString(),
      actor: trimmedActor,
      note: trimmedNote,
      kind: "promote",
    },
    payload: clonePayload(state.draft),
  };
  return {
    ...state,
    active: newActive,
    // Draft remains identical to new active until next edit.
    draft: clonePayload(newActive.payload),
    history: [state.active, ...state.history],
  };
}

export interface RollbackInput {
  toVersion: number;
  actor: string;
  note: string;
}

export function rollbackToVersion(state: ConfigState, input: RollbackInput): ConfigState {
  const trimmedNote = input.note.trim();
  if (!trimmedNote) {
    throw new Error("Rollback note is required.");
  }
  const target = state.history.find((h) => h.meta.version === input.toVersion);
  if (!target) {
    throw new Error(`No history entry found for v${input.toVersion}.`);
  }
  const trimmedActor = input.actor.trim() || "local";
  const nextVersion = state.active.meta.version + 1;
  const restored: ConfigVersion = {
    meta: {
      version: nextVersion,
      at: new Date().toISOString(),
      actor: trimmedActor,
      note: trimmedNote,
      kind: "rollback",
      rolledBackTo: input.toVersion,
    },
    payload: clonePayload(target.payload),
  };
  return {
    ...state,
    active: restored,
    draft: clonePayload(restored.payload),
    history: [state.active, ...state.history],
  };
}

export function resetDraftToActive(state: ConfigState): ConfigState {
  return { ...state, draft: clonePayload(state.active.payload) };
}

export function updateDraftSection<K extends ConfigSection>(
  state: ConfigState,
  section: K,
  next: ConfigSetPayload[K],
): ConfigState {
  return {
    ...state,
    draft: { ...state.draft, [section]: clonePayload({ [section]: next } as never)[section] },
  };
}

// ---------- Diff ----------

export interface SectionDiffSummary {
  section: ConfigSection;
  added: number;
  removed: number;
  changed: number;
  unchanged: number;
}

export interface ConfigDiff {
  fromVersion: number | "draft";
  toVersion: number | "draft";
  sections: SectionDiffSummary[];
  totalChanges: number;
}

/**
 * Pick a stable identity key for diff comparisons. Each section's primary key
 * is well-defined; if a row lacks the key we fall back to JSON for safety.
 */
function rowKey(section: ConfigSection, row: unknown): string {
  const r = row as Record<string, unknown>;
  switch (section) {
    case "organisms":
    case "antibiotics":
    case "stewardship":
      return String(r.code ?? JSON.stringify(r));
    case "ipcRules":
      return String(r.ruleCode ?? JSON.stringify(r));
    case "micBreakpoints":
    case "diskBreakpoints":
      return `${r.organismGroup}|${r.antibioticCode}|${r.standard}`;
  }
}

function diffSection(
  section: ConfigSection,
  from: unknown[],
  to: unknown[],
): SectionDiffSummary {
  const fromMap = new Map(from.map((r) => [rowKey(section, r), JSON.stringify(r)]));
  const toMap = new Map(to.map((r) => [rowKey(section, r), JSON.stringify(r)]));
  let added = 0;
  let removed = 0;
  let changed = 0;
  let unchanged = 0;
  for (const [k, v] of toMap) {
    if (!fromMap.has(k)) added++;
    else if (fromMap.get(k) !== v) changed++;
    else unchanged++;
  }
  for (const k of fromMap.keys()) {
    if (!toMap.has(k)) removed++;
  }
  return { section, added, removed, changed, unchanged };
}

export function diffPayloads(
  from: ConfigSetPayload,
  to: ConfigSetPayload,
  fromVersion: number | "draft",
  toVersion: number | "draft",
): ConfigDiff {
  const sections: SectionDiffSummary[] = CONFIG_SECTIONS.map(({ key }) =>
    diffSection(key, from[key] as unknown[], to[key] as unknown[]),
  );
  const totalChanges = sections.reduce((sum, s) => sum + s.added + s.removed + s.changed, 0);
  return { fromVersion, toVersion, sections, totalChanges };
}

export function hasDraftChanges(state: ConfigState): boolean {
  return diffPayloads(state.active.payload, state.draft, state.active.meta.version, "draft")
    .totalChanges > 0;
}

// ---------- Per-row diff drilldown ----------

export interface RowDiffEntry {
  key: string;
  status: "added" | "removed" | "changed";
  before?: unknown;
  after?: unknown;
}

export function diffSectionRows(
  section: ConfigSection,
  from: unknown[],
  to: unknown[],
): RowDiffEntry[] {
  const fromMap = new Map(from.map((r) => [rowKey(section, r), r]));
  const toMap = new Map(to.map((r) => [rowKey(section, r), r]));
  const out: RowDiffEntry[] = [];
  for (const [k, v] of toMap) {
    if (!fromMap.has(k)) {
      out.push({ key: k, status: "added", after: v });
    } else if (JSON.stringify(fromMap.get(k)) !== JSON.stringify(v)) {
      out.push({ key: k, status: "changed", before: fromMap.get(k), after: v });
    }
  }
  for (const [k, v] of fromMap) {
    if (!toMap.has(k)) out.push({ key: k, status: "removed", before: v });
  }
  return out;
}

// ---------- Active-version selectors (portable contract) ----------
//
// The rest of the app should read config through these, not by importing the
// hard-coded modules. A future server-owned config service can implement the
// same selector contract without touching consumers.

export function activeVersionLabel(state: ConfigState): string {
  return `config-v${state.active.meta.version}`;
}
