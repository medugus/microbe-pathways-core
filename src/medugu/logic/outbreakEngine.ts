import type { Accession, ASTResult, Isolate, MeduguState, PhenotypeFlag } from "../domain/types";
import { evaluateIsolate } from "./astEngine";

export type OutbreakCandidateSeverity = "review" | "watch" | "high";

export interface OutbreakIsolateSnapshot {
  id: string;
  accessionId: string;
  accessionNumber: string;
  patientMrn: string;
  patientLabel: string;
  ward?: string;
  specimenFamilyCode: string;
  specimenSubtypeCode: string;
  specimenLabel: string;
  collectedAt?: string;
  receivedAt?: string;
  observedAt: string;
  isolateId: string;
  isolateNo: number;
  organismCode: string;
  organismDisplay: string;
  phenotypeFlags: PhenotypeFlag[];
  astProfile: Record<string, string>;
  astSummary: string;
}

export interface OutbreakCandidatePair {
  id: string;
  severity: OutbreakCandidateSeverity;
  confidenceLabel: string;
  score: number;
  first: OutbreakIsolateSnapshot;
  second: OutbreakIsolateSnapshot;
  sameWard: boolean;
  bothHighRiskAreas: boolean;
  daysBetween: number;
  sharedAntibioticCount: number;
  matchingAntibioticCount: number;
  astSimilarity: number;
  matchingAntibiotics: string[];
  discordantAntibiotics: string[];
  sharedPhenotypeFlags: PhenotypeFlag[];
  reasons: string[];
  recommendedActions: string[];
  ipcHandoff: string;
  involvesActiveAccession: boolean;
}

export interface OutbreakChartPoint {
  label: string;
  count: number;
}

export interface OutbreakTimelinePoint {
  label: string;
  count: number;
}

export interface OutbreakSurveillanceSummary {
  totalComparableIsolates: number;
  candidatePairCount: number;
  highRiskPairCount: number;
  watchPairCount: number;
  reviewPairCount: number;
  activeAccessionPairCount: number;
}

export interface OutbreakSurveillanceReport {
  summary: OutbreakSurveillanceSummary;
  isolateSnapshots: OutbreakIsolateSnapshot[];
  candidatePairs: OutbreakCandidatePair[];
  wardChart: OutbreakChartPoint[];
  organismChart: OutbreakChartPoint[];
  timelineChart: OutbreakTimelinePoint[];
  limitationNote: string;
}

interface BuildOptions {
  maxWindowDays?: number;
  minScore?: number;
}

const DAY_MS = 86_400_000;
const DEFAULT_MAX_WINDOW_DAYS = 30;
const DEFAULT_MIN_SCORE = 60;
const EXCLUDED_ORGANISM_CODES = new Set(["", "NOGRO", "NO_GROWTH", "NORMAL_FLORA", "MIXED_FLORA"]);
const HIGH_RISK_WARD_TERMS = [
  "icu",
  "hdu",
  "high dependency",
  "burns",
  "transplant",
  "oncology",
  "haematology",
  "hematology",
  "neonatal",
  "nicu",
  "renal",
  "dialysis",
];

function safeDate(value?: string): Date | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time);
}

function observedAt(accession: Accession, isolate: Isolate): string {
  return (
    isolate.identifiedAt ??
    accession.specimen.collectedAt ??
    accession.specimen.receivedAt ??
    accession.createdAt
  );
}

function labelPatient(accession: Accession): string {
  const name = [accession.patient.givenName, accession.patient.familyName].filter(Boolean).join(" ");
  return name || accession.patient.mrn;
}

function isComparableIsolate(isolate: Isolate): boolean {
  if (EXCLUDED_ORGANISM_CODES.has(isolate.organismCode)) return false;
  if (isolate.significance === "normal_flora" || isolate.significance === "mixed_growth") return false;
  return true;
}

function astValue(row: ASTResult): string | undefined {
  const interpretation = row.finalInterpretation ?? row.interpretedSIR ?? row.rawInterpretation;
  if (interpretation) return interpretation;
  if (row.rawValue === undefined) return undefined;
  return `${row.rawValue}${row.rawUnit ?? ""}`;
}

function buildAstProfile(accession: Accession, isolateId: string): Record<string, string> {
  const profile: Record<string, string> = {};
  for (const row of accession.ast) {
    if (row.isolateId !== isolateId) continue;
    const value = astValue(row);
    if (!value) continue;
    profile[row.antibioticCode] = value;
  }
  return profile;
}

function astSummary(profile: Record<string, string>): string {
  const entries = Object.entries(profile).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return "No comparable AST recorded";
  return entries.map(([code, value]) => `${code}:${value}`).join(" ");
}

function derivePhenotypes(accession: Accession, isolate: Isolate): PhenotypeFlag[] {
  const direct = new Set<PhenotypeFlag>();
  for (const row of accession.ast) {
    if (row.isolateId !== isolate.id) continue;
    for (const flag of row.phenotypeFlags ?? []) direct.add(flag);
  }
  try {
    for (const flag of evaluateIsolate(accession, isolate).phenotypeFlags) direct.add(flag);
  } catch {
    // The outbreak lens should never block the workspace if an expert rule fails.
  }
  return [...direct].sort();
}

function wardIsHighRisk(ward?: string): boolean {
  const value = ward?.toLowerCase() ?? "";
  return HIGH_RISK_WARD_TERMS.some((term) => value.includes(term));
}

function daysBetween(aIso: string, bIso: string): number {
  const a = safeDate(aIso);
  const b = safeDate(bIso);
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.abs(a.getTime() - b.getTime()) / DAY_MS;
}

function sameNormalisedWard(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function intersect<T>(a: T[], b: T[]): T[] {
  const bSet = new Set(b);
  return a.filter((value) => bSet.has(value));
}

function compareAst(
  first: Record<string, string>,
  second: Record<string, string>,
): {
  shared: string[];
  matching: string[];
  discordant: string[];
  similarity: number;
} {
  const shared = Object.keys(first)
    .filter((code) => second[code] !== undefined)
    .sort();
  const matching = shared.filter((code) => first[code] === second[code]);
  const discordant = shared.filter((code) => first[code] !== second[code]);
  return {
    shared,
    matching,
    discordant,
    similarity: shared.length === 0 ? 0 : matching.length / shared.length,
  };
}

function severityFor(score: number, sameWard: boolean): OutbreakCandidateSeverity {
  if (score >= 90 || (score >= 85 && sameWard)) return "high";
  if (score >= 75) return "watch";
  return "review";
}

function confidenceLabel(severity: OutbreakCandidateSeverity): string {
  if (severity === "high") return "High priority";
  if (severity === "watch") return "Outbreak watch";
  return "Review";
}

function formatDayWindow(days: number): string {
  if (!Number.isFinite(days)) return "date unavailable";
  if (days < 1) return "same day";
  const rounded = Math.round(days * 10) / 10;
  return `${rounded} day${rounded === 1 ? "" : "s"} apart`;
}

function scorePair(first: OutbreakIsolateSnapshot, second: OutbreakIsolateSnapshot) {
  const sameWard = sameNormalisedWard(first.ward, second.ward);
  const bothHighRiskAreas = wardIsHighRisk(first.ward) && wardIsHighRisk(second.ward);
  const intervalDays = daysBetween(first.observedAt, second.observedAt);
  const ast = compareAst(first.astProfile, second.astProfile);
  const sharedPhenotypeFlags = intersect(first.phenotypeFlags, second.phenotypeFlags);

  let score = 35;
  const reasons: string[] = [`Same organism: ${first.organismDisplay}`];

  if (intervalDays <= 7) {
    score += 20;
    reasons.push(`Close timing: ${formatDayWindow(intervalDays)}`);
  } else if (intervalDays <= 14) {
    score += 14;
    reasons.push(`Recent timing: ${formatDayWindow(intervalDays)}`);
  } else if (intervalDays <= DEFAULT_MAX_WINDOW_DAYS) {
    score += 8;
    reasons.push(`Within surveillance window: ${formatDayWindow(intervalDays)}`);
  }

  if (sameWard) {
    score += 18;
    reasons.push(`Same ward/unit: ${first.ward}`);
  } else if (bothHighRiskAreas) {
    score += 6;
    reasons.push("Both cases are in high-risk clinical areas");
  } else if (first.ward || second.ward) {
    reasons.push(`Locations: ${first.ward ?? "ward unavailable"} and ${second.ward ?? "ward unavailable"}`);
  }

  if (first.specimenFamilyCode === second.specimenFamilyCode) {
    score += 6;
    reasons.push(`Same specimen family: ${first.specimenFamilyCode}`);
  }
  if (first.specimenSubtypeCode === second.specimenSubtypeCode) {
    score += 4;
    reasons.push(`Same specimen subtype: ${first.specimenSubtypeCode}`);
  }

  if (sharedPhenotypeFlags.length > 0) {
    score += 14;
    reasons.push(`Shared phenotype: ${sharedPhenotypeFlags.join("+")}`);
  }

  if (ast.shared.length >= 3) {
    score += Math.round(ast.similarity * 24);
    reasons.push(
      `AST concordance: ${ast.matching.length}/${ast.shared.length} shared drugs match`,
    );
  } else if (ast.shared.length > 0) {
    score += Math.round(ast.similarity * 14);
    reasons.push(
      `Limited AST concordance: ${ast.matching.length}/${ast.shared.length} shared drugs match`,
    );
  } else {
    reasons.push("No overlapping AST rows; review relies on organism, timing and location");
  }

  if (ast.shared.length >= 5 && ast.similarity >= 0.9) score += 4;

  return {
    score: Math.min(100, Math.round(score)),
    sameWard,
    bothHighRiskAreas,
    intervalDays,
    ast,
    sharedPhenotypeFlags,
    reasons,
  };
}

function recommendedActions(pair: {
  severity: OutbreakCandidateSeverity;
  sameWard: boolean;
  sharedAntibioticCount: number;
  astSimilarity: number;
}): string[] {
  const actions = [
    "Review bed-space, ward movement, procedure and device overlap for both patients.",
    "Confirm organism ID and AST profile before declaring epidemiological linkage.",
    "Escalate to IPC for contact-precaution, cleaning and exposure review if clinically plausible.",
  ];

  if (pair.sharedAntibioticCount > 0 && pair.astSimilarity >= 0.85) {
    actions.push("Prioritise the pair for reference typing or WGS if local policy supports confirmatory testing.");
  }
  if (pair.sameWard || pair.severity === "high") {
    actions.unshift("Open an IPC huddle and verify current isolation status for both cases.");
  }
  return actions;
}

function buildHandoff(pair: OutbreakCandidatePair): string {
  const first = pair.first;
  const second = pair.second;
  return `${pair.confidenceLabel} outbreak candidate: ${first.organismDisplay} in ${first.patientLabel} (${first.accessionNumber}, ${first.ward ?? "ward unavailable"}) and ${second.patientLabel} (${second.accessionNumber}, ${second.ward ?? "ward unavailable"}). Score ${pair.score}/100. Evidence: ${pair.reasons.join("; ")}. Recommended action: ${pair.recommendedActions[0]}`;
}

export function buildOutbreakIsolateSnapshots(
  accessions: MeduguState["accessions"],
): OutbreakIsolateSnapshot[] {
  const snapshots: OutbreakIsolateSnapshot[] = [];

  for (const accession of Object.values(accessions)) {
    for (const isolate of accession.isolates) {
      if (!isComparableIsolate(isolate)) continue;
      const observed = observedAt(accession, isolate);
      const snapshot: OutbreakIsolateSnapshot = {
        id: `${accession.id}:${isolate.id}`,
        accessionId: accession.id,
        accessionNumber: accession.accessionNumber,
        patientMrn: accession.patient.mrn,
        patientLabel: labelPatient(accession),
        ward: accession.patient.ward,
        specimenFamilyCode: accession.specimen.familyCode,
        specimenSubtypeCode: accession.specimen.subtypeCode,
        specimenLabel: accession.specimen.freeTextLabel ?? accession.specimen.subtypeCode,
        collectedAt: accession.specimen.collectedAt,
        receivedAt: accession.specimen.receivedAt,
        observedAt: observed,
        isolateId: isolate.id,
        isolateNo: isolate.isolateNo,
        organismCode: isolate.organismCode,
        organismDisplay: isolate.organismDisplay,
        phenotypeFlags: derivePhenotypes(accession, isolate),
        astProfile: buildAstProfile(accession, isolate.id),
        astSummary: "",
      };
      snapshot.astSummary = astSummary(snapshot.astProfile);
      snapshots.push(snapshot);
    }
  }

  return snapshots.sort((a, b) => b.observedAt.localeCompare(a.observedAt));
}

export function buildOutbreakCandidatePairs(
  snapshots: OutbreakIsolateSnapshot[],
  activeAccessionId?: string | null,
  options: BuildOptions = {},
): OutbreakCandidatePair[] {
  const maxWindowDays = options.maxWindowDays ?? DEFAULT_MAX_WINDOW_DAYS;
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;
  const pairs: OutbreakCandidatePair[] = [];

  for (let i = 0; i < snapshots.length; i += 1) {
    for (let j = i + 1; j < snapshots.length; j += 1) {
      const first = snapshots[i];
      const second = snapshots[j];
      if (first.organismCode !== second.organismCode) continue;
      if (first.patientMrn === second.patientMrn) continue;

      const scored = scorePair(first, second);
      if (scored.intervalDays > maxWindowDays) continue;
      if (scored.score < minScore) continue;

      const severity = severityFor(scored.score, scored.sameWard);
      const partial = {
        id: [first.id, second.id].sort().join("__"),
        severity,
        confidenceLabel: confidenceLabel(severity),
        score: scored.score,
        first,
        second,
        sameWard: scored.sameWard,
        bothHighRiskAreas: scored.bothHighRiskAreas,
        daysBetween: scored.intervalDays,
        sharedAntibioticCount: scored.ast.shared.length,
        matchingAntibioticCount: scored.ast.matching.length,
        astSimilarity: scored.ast.similarity,
        matchingAntibiotics: scored.ast.matching,
        discordantAntibiotics: scored.ast.discordant,
        sharedPhenotypeFlags: scored.sharedPhenotypeFlags,
        reasons: scored.reasons,
        recommendedActions: [] as string[],
        ipcHandoff: "",
        involvesActiveAccession:
          first.accessionId === activeAccessionId || second.accessionId === activeAccessionId,
      } satisfies Omit<OutbreakCandidatePair, "recommendedActions" | "ipcHandoff"> & {
        recommendedActions: string[];
        ipcHandoff: string;
      };

      const pair: OutbreakCandidatePair = {
        ...partial,
        recommendedActions: recommendedActions({
          severity,
          sameWard: scored.sameWard,
          sharedAntibioticCount: scored.ast.shared.length,
          astSimilarity: scored.ast.similarity,
        }),
        ipcHandoff: "",
      };
      pair.ipcHandoff = buildHandoff(pair);
      pairs.push(pair);
    }
  }

  return pairs.sort((a, b) => {
    if (a.involvesActiveAccession !== b.involvesActiveAccession) {
      return a.involvesActiveAccession ? -1 : 1;
    }
    if (b.score !== a.score) return b.score - a.score;
    return a.daysBetween - b.daysBetween;
  });
}

function increment(map: Map<string, number>, key: string, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

function topChartPoints(map: Map<string, number>, limit = 6): OutbreakChartPoint[] {
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function buildCharts(candidatePairs: OutbreakCandidatePair[]) {
  const wardCounts = new Map<string, number>();
  const organismCounts = new Map<string, number>();
  const timelineCounts = new Map<string, number>();
  const linkedSnapshots = new Map<string, OutbreakIsolateSnapshot>();

  for (const pair of candidatePairs) {
    increment(organismCounts, pair.first.organismDisplay);
    linkedSnapshots.set(pair.first.id, pair.first);
    linkedSnapshots.set(pair.second.id, pair.second);
  }

  for (const snapshot of linkedSnapshots.values()) {
    increment(wardCounts, snapshot.ward ?? "Ward not recorded");
    const day = safeDate(snapshot.observedAt)?.toISOString().slice(0, 10) ?? "Date unavailable";
    increment(timelineCounts, day);
  }

  return {
    wardChart: topChartPoints(wardCounts),
    organismChart: topChartPoints(organismCounts),
    timelineChart: [...timelineCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  };
}

export function buildOutbreakSurveillanceReport(
  accessions: MeduguState["accessions"],
  activeAccessionId?: string | null,
  options: BuildOptions = {},
): OutbreakSurveillanceReport {
  const isolateSnapshots = buildOutbreakIsolateSnapshots(accessions);
  const candidatePairs = buildOutbreakCandidatePairs(isolateSnapshots, activeAccessionId, options);
  const charts = buildCharts(candidatePairs);

  return {
    summary: {
      totalComparableIsolates: isolateSnapshots.length,
      candidatePairCount: candidatePairs.length,
      highRiskPairCount: candidatePairs.filter((p) => p.severity === "high").length,
      watchPairCount: candidatePairs.filter((p) => p.severity === "watch").length,
      reviewPairCount: candidatePairs.filter((p) => p.severity === "review").length,
      activeAccessionPairCount: candidatePairs.filter((p) => p.involvesActiveAccession).length,
    },
    isolateSnapshots,
    candidatePairs,
    ...charts,
    limitationNote:
      "Prototype surveillance: uses currently loaded LIMS cases and phenotypic similarity. Confirm outbreaks with IPC investigation, patient movement data and reference typing/WGS where available.",
  };
}
