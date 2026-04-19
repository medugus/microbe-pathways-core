// Benchmark harness — pure, framework-agnostic.
//
// Tracks per-scenario telemetry (clicks, screen transitions, time-on-task,
// rule-explanation visibility, blocker visibility, export availability) and
// publishes machine-readable scenario acceptance summaries.
//
// UI components emit events via this harness; React is not imported here.

import type { Accession } from "../domain/types";
import { evaluateAccession } from "./astEngine";
import { evaluateStewardship } from "./stewardshipEngine";
import { evaluateIPC } from "./ipcEngine";
import { runValidation } from "./validationEngine";
import { evaluateExportGate } from "./exportEngine";

// ---------- Scenario catalogue ----------

export type ScenarioId =
  | "MRSA_BSI"
  | "ESBL_UTI"
  | "CRE_STERILE_SITE"
  | "SPUTUM_BARTLETT_REJECT"
  | "CSF_CONSULTANT_RELEASE"
  | "SCREEN_CLEARANCE";

export interface ScenarioAcceptance {
  id: ScenarioId;
  title: string;
  accessionId: string;
  expected: {
    rules: string[];
    phenotypes: string[];
    blockers: string[];
    warnings: string[];
    visibility: {
      mustSuppress: string[];
      mustShow: string[];
    };
    export: { availableAfterRelease: boolean };
  };
  metrics: {
    clicks: number;
    screenTransitions: number;
    timeOnTaskMs: number;
    ruleExplanationVisible: boolean;
    blockersVisible: boolean;
    exportAvailable: boolean;
  };
}

export const SCENARIO_CATALOGUE: Omit<ScenarioAcceptance, "metrics" | "accessionId">[] = [
  {
    id: "MRSA_BSI",
    title: "MRSA bloodstream infection",
    expected: {
      rules: ["STA_MRSA"],
      phenotypes: ["MRSA"],
      blockers: ["PHONE_OUT_REQUIRED"],
      warnings: [],
      visibility: { mustSuppress: ["AMP", "CRO"], mustShow: ["VAN"] },
      export: { availableAfterRelease: true },
    },
  },
  {
    id: "ESBL_UTI",
    title: "ESBL urinary tract infection",
    expected: {
      rules: ["ENB_ESBL"],
      phenotypes: ["ESBL"],
      blockers: [],
      warnings: [],
      visibility: { mustSuppress: ["CRO", "CAZ"], mustShow: ["NIT", "FOS"] },
      export: { availableAfterRelease: true },
    },
  },
  {
    id: "CRE_STERILE_SITE",
    title: "CRE sterile-site infection",
    expected: {
      rules: ["ENB_CRE"],
      phenotypes: ["CRE", "carbapenemase_suspected"],
      blockers: ["PHONE_OUT_REQUIRED"],
      warnings: [],
      visibility: { mustSuppress: [], mustShow: ["MEM"] },
      export: { availableAfterRelease: true },
    },
  },
  {
    id: "SPUTUM_BARTLETT_REJECT",
    title: "Sputum quality rejection (Bartlett)",
    expected: {
      rules: [],
      phenotypes: [],
      blockers: [],
      warnings: ["MIC_REQUIRED_MISSING"],
      visibility: { mustSuppress: [], mustShow: [] },
      export: { availableAfterRelease: true },
    },
  },
  {
    id: "CSF_CONSULTANT_RELEASE",
    title: "CSF meningitis with consultant-controlled release",
    expected: {
      rules: [],
      phenotypes: [],
      blockers: ["CONSULTANT_APPROVAL_REQUIRED"],
      warnings: [],
      visibility: { mustSuppress: ["NIT"], mustShow: ["CRO"] },
      export: { availableAfterRelease: true },
    },
  },
  {
    id: "SCREEN_CLEARANCE",
    title: "Admission screening positivity & clearance",
    expected: {
      rules: [],
      phenotypes: [],
      blockers: [],
      warnings: [],
      visibility: { mustSuppress: ["VAN", "MEM"], mustShow: [] },
      export: { availableAfterRelease: true },
    },
  },
];

// Map seeded accession ids → scenario ids. Updated by demoAccessions.ts.
export const SCENARIO_ACCESSION_MAP: Record<ScenarioId, string> = {
  MRSA_BSI: "MB25-EF34GH",
  ESBL_UTI: "MB25-AB12CD",
  CRE_STERILE_SITE: "MB25-CRE001",
  SPUTUM_BARTLETT_REJECT: "MB25-NP78QR",
  CSF_CONSULTANT_RELEASE: "MB25-JK56LM",
  SCREEN_CLEARANCE: "MB25-ST90UV",
};

// ---------- Live evaluation ----------

export function evaluateScenarioMetrics(
  accession: Accession,
  liveMetrics: { clicks: number; screenTransitions: number; timeOnTaskMs: number; ruleExplanationVisible: boolean },
): ScenarioAcceptance["metrics"] {
  const v = runValidation(accession);
  const gate = evaluateExportGate(accession);
  return {
    clicks: liveMetrics.clicks,
    screenTransitions: liveMetrics.screenTransitions,
    timeOnTaskMs: liveMetrics.timeOnTaskMs,
    ruleExplanationVisible: liveMetrics.ruleExplanationVisible,
    blockersVisible: v.blockers.length > 0,
    exportAvailable: gate.available,
  };
}

export interface ScenarioObservation {
  rules: string[];
  phenotypes: string[];
  blockers: string[];
  warnings: string[];
  ipcSignals: string[];
  exportAvailable: boolean;
  exportReason?: string;
}

export function observeScenario(accession: Accession): ScenarioObservation {
  const ast = evaluateAccession(accession);
  const sw = evaluateStewardship(accession);
  void sw;
  const ipc = evaluateIPC(accession);
  const v = runValidation(accession);
  const gate = evaluateExportGate(accession);
  const rules = new Set<string>();
  const phenotypes = new Set<string>();
  for (const o of ast) {
    o.fired.forEach((f) => rules.add(f.ruleCode));
    o.phenotypeFlags.forEach((p) => phenotypes.add(p));
  }
  return {
    rules: [...rules],
    phenotypes: [...phenotypes],
    blockers: v.blockers.map((b) => b.code),
    warnings: v.warnings.map((w) => w.code),
    ipcSignals: ipc.decisions.map((d) => d.ruleCode),
    exportAvailable: gate.available,
    exportReason: gate.reason,
  };
}

// ---------- Telemetry recorder (no React) ----------

export interface MetricsSnapshot {
  scenarioId: ScenarioId | null;
  accessionId: string | null;
  startedAt: number;
  clicks: number;
  screenTransitions: number;
  ruleExplanationVisible: boolean;
  events: { at: number; kind: string; detail?: string }[];
}

type Listener = (s: MetricsSnapshot) => void;

function emptySnapshot(): MetricsSnapshot {
  return {
    scenarioId: null,
    accessionId: null,
    startedAt: Date.now(),
    clicks: 0,
    screenTransitions: 0,
    ruleExplanationVisible: false,
    events: [],
  };
}

class Harness {
  private snap: MetricsSnapshot = emptySnapshot();
  private listeners = new Set<Listener>();

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  private emit() {
    for (const l of this.listeners) l(this.snap);
  }
  get(): MetricsSnapshot {
    return this.snap;
  }
  bind(scenarioId: ScenarioId | null, accessionId: string | null) {
    this.snap = { ...emptySnapshot(), scenarioId, accessionId };
    this.emit();
  }
  reset() {
    this.snap = { ...emptySnapshot(), scenarioId: this.snap.scenarioId, accessionId: this.snap.accessionId };
    this.emit();
  }
  recordClick(detail?: string) {
    this.snap = {
      ...this.snap,
      clicks: this.snap.clicks + 1,
      events: [...this.snap.events, { at: Date.now(), kind: "click", detail }],
    };
    this.emit();
  }
  recordScreenTransition(detail?: string) {
    this.snap = {
      ...this.snap,
      screenTransitions: this.snap.screenTransitions + 1,
      events: [...this.snap.events, { at: Date.now(), kind: "screen_transition", detail }],
    };
    this.emit();
  }
  setRuleExplanationVisible(v: boolean) {
    this.snap = { ...this.snap, ruleExplanationVisible: v };
    this.emit();
  }
  elapsedMs(): number {
    return Date.now() - this.snap.startedAt;
  }
}

export const benchmark = new Harness();
