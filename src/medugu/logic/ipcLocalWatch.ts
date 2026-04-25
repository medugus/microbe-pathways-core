import type { Accession, MeduguState } from "../domain/types";
import { evaluateIPC } from "./ipcEngine";

export type LocalWatchSeverity = "none" | "review" | "watch" | "high";

export type LocalOutbreakWatchItem = {
  id: string;
  ward?: string;
  organismLabel?: string;
  phenotypeLabel?: string;
  ipcFlagCode?: string;
  windowDays: number;
  rawCaseCount: number;
  patientAdjustedCount: number;
  relatedAccessions: string[];
  severity: LocalWatchSeverity;
  triggerSummary: string;
  recommendedAction: string;
  limitationNote: string;
};

type ComparableCase = {
  accessionId: string;
  mrn: string;
  ward?: string;
  organismCode?: string;
  organismLabel?: string;
  phenotypeLabel?: string;
  ipcFlagCode?: string;
  observedAtMs: number;
};

export const DEFAULT_LOCAL_WATCH_WINDOW_DAYS = 7;

const DAY_MS = 86_400_000;
const HIGH_RISK_WARD_TERMS = [
  "icu",
  "nicu",
  "oncology",
  "transplant",
  "haematology",
  "hematology",
  "stem cell",
];

function safeDateMs(value?: string): number {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

function normaliseWard(ward?: string): string | undefined {
  const trimmed = ward?.trim();
  return trimmed ? trimmed : undefined;
}

function wardIsHighRisk(ward?: string): boolean {
  const normalised = ward?.toLowerCase() ?? "";
  return HIGH_RISK_WARD_TERMS.some((term) => normalised.includes(term));
}

function phenotypeFromDecision(
  phenotypes: string[],
  fallbackRuleCode?: string,
): string | undefined {
  if (phenotypes.length > 0) {
    return [...phenotypes].sort().join("+");
  }
  return fallbackRuleCode;
}

function buildComparableCases(accessions: Accession[]): ComparableCase[] {
  return accessions.flatMap((accession) => {
    const report = evaluateIPC(accession);
    const isolateById = new Map(accession.isolates.map((iso) => [iso.id, iso]));

    return report.decisions.map((decision) => {
      const isolate = isolateById.get(decision.isolateId);
      return {
        accessionId: accession.id,
        mrn: accession.patient.mrn,
        ward: normaliseWard(accession.patient.ward),
        organismCode: decision.organismCode ?? isolate?.organismCode,
        organismLabel: isolate?.organismDisplay ?? decision.organismCode,
        phenotypeLabel: phenotypeFromDecision(decision.phenotypes, decision.ruleCode),
        ipcFlagCode: decision.ruleCode,
        observedAtMs:
          safeDateMs(accession.specimen.collectedAt) ||
          safeDateMs(accession.specimen.receivedAt) ||
          safeDateMs(accession.createdAt),
      };
    });
  });
}

function uniqueAccessions(cases: ComparableCase[]): string[] {
  return [...new Set(cases.map((item) => item.accessionId))];
}

export function deduplicateByPatientEpisode(cases: ComparableCase[]): ComparableCase[] {
  const latestByMrn = new Map<string, ComparableCase>();

  for (const item of cases) {
    const existing = latestByMrn.get(item.mrn);
    if (!existing || item.observedAtMs >= existing.observedAtMs) {
      latestByMrn.set(item.mrn, item);
    }
  }

  return [...latestByMrn.values()];
}

export function getWatchSeverity(group: {
  patientAdjustedCount: number;
  ward?: string;
}): LocalWatchSeverity {
  if (group.patientAdjustedCount >= 3 && wardIsHighRisk(group.ward)) {
    return "high";
  }
  if (group.patientAdjustedCount >= 3) {
    return "watch";
  }
  if (group.patientAdjustedCount >= 2) {
    return "review";
  }
  return "none";
}

function actionForSeverity(severity: LocalWatchSeverity): string {
  switch (severity) {
    case "high":
      return "Outbreak watch: expedite IPC huddle, reinforce isolation/cleaning measures, and review transmission links in currently loaded cases.";
    case "watch":
      return "Outbreak watch: initiate IPC cluster review and verify ward-level precautions for currently loaded cases.";
    case "review":
      return "Possible cluster: review linked cases, specimen timing, and placement precautions in currently loaded cases.";
    default:
      return "No local cluster threshold reached among currently loaded cases; continue routine IPC review.";
  }
}

export function describeLocalWatchLimitations(): string {
  return "Browser-local only: evaluates currently loaded cases in this browser and requires backend persistence for hospital-wide surveillance.";
}

export function groupComparableCases(
  accessions: Accession[],
  windowDays: number = DEFAULT_LOCAL_WATCH_WINDOW_DAYS,
): LocalOutbreakWatchItem[] {
  const comparableCases = buildComparableCases(accessions);
  const now = Date.now();
  const windowMs = windowDays * DAY_MS;
  const grouped = new Map<string, ComparableCase[]>();

  for (const entry of comparableCases) {
    if (entry.observedAtMs && now - entry.observedAtMs > windowMs) continue;

    const key = [
      entry.ward ?? "no-ward",
      entry.organismCode ?? "no-organism",
      entry.phenotypeLabel ?? "no-phenotype",
      entry.ipcFlagCode ?? "no-ipc",
    ].join("|");
    grouped.set(key, [...(grouped.get(key) ?? []), entry]);
  }

  const limitationNote = describeLocalWatchLimitations();

  return [...grouped.entries()]
    .map(([key, groupedCases]) => {
      const deduped = deduplicateByPatientEpisode(groupedCases);
      const sample = groupedCases[0];
      const patientAdjustedCount = deduped.length;
      const severity = getWatchSeverity({ patientAdjustedCount, ward: sample.ward });
      const locationLabel = sample.ward ? `in ${sample.ward}` : "with ward/unit unavailable";
      const phenotypeLabel = sample.phenotypeLabel ? ` / ${sample.phenotypeLabel}` : "";

      return {
        id: key,
        ward: sample.ward,
        organismLabel: sample.organismLabel,
        phenotypeLabel: sample.phenotypeLabel,
        ipcFlagCode: sample.ipcFlagCode,
        windowDays,
        rawCaseCount: groupedCases.length,
        patientAdjustedCount,
        relatedAccessions: uniqueAccessions(groupedCases),
        severity,
        triggerSummary: `${patientAdjustedCount} patient-adjusted comparable case(s) ${locationLabel} for ${sample.organismLabel ?? sample.organismCode ?? "organism"}${phenotypeLabel} in ${windowDays}-day window.`,
        recommendedAction: actionForSeverity(severity),
        limitationNote,
      };
    })
    .sort((a, b) => {
      const severityWeight: Record<LocalWatchSeverity, number> = {
        none: 0,
        review: 1,
        watch: 2,
        high: 3,
      };
      if (severityWeight[b.severity] !== severityWeight[a.severity]) {
        return severityWeight[b.severity] - severityWeight[a.severity];
      }
      return b.patientAdjustedCount - a.patientAdjustedCount;
    });
}

export function deriveLocalOutbreakWatch(
  currentAccession: Accession,
  allAccessions: MeduguState["accessions"],
  windowDays: number = DEFAULT_LOCAL_WATCH_WINDOW_DAYS,
): {
  summary: "no local cluster" | "possible cluster" | "outbreak watch";
  items: LocalOutbreakWatchItem[];
  signalItems: LocalOutbreakWatchItem[];
  limitationNote: string;
  currentAccessionRelated: string[];
} {
  const allLoaded = Object.values(allAccessions);
  const items = groupComparableCases(allLoaded, windowDays);
  const signalItems = items.filter((item) => item.severity !== "none");
  const summary = signalItems.some((item) => item.severity === "watch" || item.severity === "high")
    ? "outbreak watch"
    : signalItems.some((item) => item.severity === "review")
      ? "possible cluster"
      : "no local cluster";

  const currentAccessionRelated = signalItems
    .filter((item) => item.relatedAccessions.includes(currentAccession.id))
    .flatMap((item) => item.relatedAccessions);

  return {
    summary,
    items,
    signalItems,
    limitationNote: describeLocalWatchLimitations(),
    currentAccessionRelated: [...new Set(currentAccessionRelated)],
  };
}
