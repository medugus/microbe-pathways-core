// Live report preview — clinician-facing structured projection.
// Pure; reads accession state + runs stewardship/IPC engines and obeys
// suppression visibility rules. Suppressed/restricted rows carry a reason.

import type { Accession } from "../domain/types";
import { resolveSpecimen } from "./specimenResolver";
import { getAntibiotic } from "../config/antibiotics";
import { evaluateStewardship, type StewardshipDecision } from "./stewardshipEngine";
import { evaluateIPC } from "./ipcEngine";
import { IPC_RULES } from "../config/ipcRules";
import {
  deriveIPCInternalReportNotes,
  getIPCReportVisibility,
  shouldShowIPCOnClinicianReport,
} from "./ipcReportGovernance";
import { evaluateAccession } from "./astEngine";
import { getOrganism } from "../config/organisms";
import { findDiskBreakpoint, findMICBreakpoint } from "../config/breakpoints";

export type CommentSource = "clinical" | "stewardship" | "ipc";

export interface ReportComment {
  source: CommentSource;
  code: string;
  text: string;
  /** When true, content is governed/structured rather than free-text. */
  governed?: boolean;
}

export interface ReportASTRow {
  antibioticCode: string;
  antibioticDisplay: string;
  method: string;
  rawValue?: number;
  rawUnit?: string;
  interpretation?: string;
  governance: string;
  /** Whether to render to clinician (false = listed as suppressed with reason). */
  visibleToClinician: boolean;
  suppressionReason?: string;
  releaseClass?: string;
  aware?: string;
  phenotypeFlags?: string[];
  /** Active breakpoint cutoffs used to derive S/I/R, if any matched. */
  breakpoint?: {
    standard: string;
    summary: string; // e.g. "S≥17 / R≤13 mm" or "S≤1 / R≥4 mg/L"
    susceptible?: number;
    resistant?: number;
    unit: "mm" | "mg/L";
  };
}

export interface ReportIsolate {
  isolateNo: number;
  organismDisplay: string;
  significance?: string;
  growth?: string;
  phenotypeFlags: string[];
  /** Blood-culture only: positive (set, bottle) sources for this isolate. */
  bloodSourceLinks?: { setNo: number; bottleType: string }[];
  /** Blood-culture only: per-bottle growth rows (mirrored for export). */
  bottleResults?: {
    setNo: number;
    bottleType: string;
    growth: string;
    positiveAt?: string;
    ttpHours?: number;
  }[];
  ast: ReportASTRow[];
}

export interface ReportBloodSet {
  setNo: number;
  drawSite: string;
  lumenLabel?: string;
  bottleTypes: string[];
  drawTime?: string;
}

export interface ReportPreviewDoc {
  accessionNumber: string;
  releaseState: string;
  reportVersion: number;
  patient: { name: string; mrn: string; sex: string; ward?: string };
  specimen: { display: string; syndrome?: string; pathway: string };
  /** Per-set blood culture details, when specimen family is BLOOD. */
  bloodSets?: ReportBloodSet[];
  microscopySummary: string;
  isolates: ReportIsolate[];
  comments: ReportComment[];
  ipc: {
    ruleCode: string;
    message: string;
    actions: string[];
    timing: string;
    visibility: string;
  }[];
  internalNotes: string[];
  versions: {
    rule: string;
    breakpoint: string;
    export: string;
    build: string;
  };
  generatedAt: string;
}

export function buildReportPreview(accession: Accession): ReportPreviewDoc {
  const r = resolveSpecimen(accession.specimen.familyCode, accession.specimen.subtypeCode);
  const profile = r.ok ? r.profile : null;
  const stewardship = evaluateStewardship(accession);
  const ipcReport = evaluateIPC(accession);
  const astByIsolate = evaluateAccession(accession);

  const phenotypesByIsolate: Record<string, string[]> = {};
  for (const o of astByIsolate) phenotypesByIsolate[o.isolateId] = o.phenotypeFlags;

  const isolates: ReportIsolate[] = accession.isolates.map((i) => {
    const rowOutputs = astByIsolate.find((o) => o.isolateId === i.id);
    const orgGroup = getOrganism(i.organismCode)?.group;
    return {
      isolateNo: i.isolateNo,
      organismDisplay: i.organismDisplay,
      significance: i.significance,
      growth:
        i.colonyCountCfuPerMl !== undefined
          ? `${i.colonyCountCfuPerMl.toExponential(0)} CFU/mL`
          : i.growthQuantifierCode,
      phenotypeFlags: phenotypesByIsolate[i.id] ?? [],
      bloodSourceLinks:
        i.bloodSourceLinks && i.bloodSourceLinks.length > 0 ? i.bloodSourceLinks : undefined,
      bottleResults:
        i.bottleResults && i.bottleResults.length > 0
          ? i.bottleResults.map((r) => ({
              setNo: r.setNo,
              bottleType: r.bottleType,
              growth: r.growth,
              positiveAt: r.positiveAt,
              ttpHours: r.ttpHours,
            }))
          : undefined,
      ast: accession.ast
        .filter((a) => a.isolateId === i.id)
        .map<ReportASTRow>((a) => {
          const dec: StewardshipDecision | undefined = stewardship.byAst[a.id];
          const enginePatch = rowOutputs?.rowPatches[a.id];
          const interp =
            a.finalInterpretation ??
            enginePatch?.interpretedSIR ??
            a.interpretedSIR ??
            a.rawInterpretation;
          let breakpoint: ReportASTRow["breakpoint"];
          if (a.method === "disk_diffusion") {
            const bp = findDiskBreakpoint(orgGroup, a.antibioticCode, a.standard);
            if (bp) {
              const parts: string[] = [];
              if (bp.susceptibleMinMm !== undefined) parts.push(`S≥${bp.susceptibleMinMm}`);
              if (bp.resistantMaxMm !== undefined) parts.push(`R≤${bp.resistantMaxMm}`);
              breakpoint = {
                standard: bp.standard,
                summary: `${parts.join(" / ")} mm`,
                susceptible: bp.susceptibleMinMm,
                resistant: bp.resistantMaxMm,
                unit: "mm",
              };
            }
          } else if (
            a.method === "mic_broth" ||
            a.method === "mic_etest" ||
            a.method === "automated_phoenix" ||
            a.method === "automated_vitek"
          ) {
            const bp = findMICBreakpoint(orgGroup, a.antibioticCode, a.standard);
            if (bp) {
              const parts: string[] = [];
              if (bp.susceptibleMaxMgL !== undefined) parts.push(`S≤${bp.susceptibleMaxMgL}`);
              if (bp.resistantMinMgL !== undefined) parts.push(`R≥${bp.resistantMinMgL}`);
              breakpoint = {
                standard: bp.standard,
                summary: `${parts.join(" / ")} mg/L`,
                susceptible: bp.susceptibleMaxMgL,
                resistant: bp.resistantMinMgL,
                unit: "mg/L",
              };
            }
          }
          return {
            antibioticCode: a.antibioticCode,
            antibioticDisplay: getAntibiotic(a.antibioticCode)?.display ?? a.antibioticCode,
            method: a.method,
            rawValue: a.rawValue,
            rawUnit: a.rawUnit,
            interpretation: interp,
            governance: a.governance,
            visibleToClinician: dec?.visibleToClinician ?? true,
            suppressionReason: dec?.suppressionReason,
            releaseClass: dec?.releaseClass,
            aware: dec?.aware,
            phenotypeFlags: enginePatch?.phenotypeFlags ?? a.phenotypeFlags,
            breakpoint,
          };
        }),
    };
  });

  const comments: ReportComment[] = [];
  for (const c of accession.interpretiveComments) {
    const source: CommentSource =
      c.scope === "ast" ? "stewardship" : c.scope === "isolate" ? "clinical" : "clinical";
    comments.push({ source, code: c.code, text: c.text });
  }
  for (const note of stewardship.notes) {
    comments.push({ source: "stewardship", code: note.flag, text: note.message, governed: true });
  }
  // Persisted notes in state too, for amendments etc.
  for (const s of accession.stewardship) {
    comments.push({ source: "stewardship", code: s.flag, text: s.message });
  }
  // Blood culture isolate-allocation derived comments (contaminant carry,
  // triple-pathogen senior-review) — governed, derived from rules module.
  if (accession.specimen.familyCode === "BLOOD") {
    const real = accession.isolates.filter((i) => i.organismCode !== "NOGRO");
    for (const iso of real) {
      if (iso.significance === "probable_contaminant") {
        comments.push({
          source: "clinical",
          code: "BC_ISO_CONTAMINANT",
          text: `Isolate ${iso.isolateNo} (${iso.organismDisplay}) reported as probable contaminant — interpret with caution.`,
          governed: true,
        });
      }
    }
    if (real.length === 3 && real.every((i) => i.significance === "significant")) {
      comments.push({
        source: "clinical",
        code: "BC_ISO_TRIPLE_PATHOGEN_REVIEW",
        text: "Three blood-culture isolates all reported as true pathogens — senior/consultant review recommended.",
        governed: true,
      });
    }
  }

  const clinicianIPC = ipcReport.decisions
    .map((decision) => {
      const signal = accession.ipc.find((s) => s.ruleCode === decision.ruleCode);
      if (!signal) return null;
      const rule = IPC_RULES.find((r) => r.ruleCode === decision.ruleCode);
      if (!shouldShowIPCOnClinicianReport(signal, rule)) return null;
      return {
        ruleCode: decision.ruleCode,
        message: rule?.clinicianReportText?.trim() || decision.message,
        actions: [...decision.actions],
        timing: decision.timing,
        visibility: getIPCReportVisibility(signal, rule),
      };
    })
    .filter((entry) => !!entry);

  const internalIpcNotes = deriveIPCInternalReportNotes(accession);

  const microscopySummary =
    accession.microscopy.length === 0
      ? "No microscopy recorded."
      : accession.microscopy
          .map((m) => `${m.stainCode}: ${m.result}${m.notes ? ` (${m.notes})` : ""}`)
          .join("; ");

  // Per-set blood culture details (Epic Beaker-style), only when present.
  let bloodSets: ReportBloodSet[] | undefined;
  const rawSets = (accession.specimen.details as Record<string, unknown> | undefined)?.sets;
  if (Array.isArray(rawSets) && rawSets.length > 0) {
    bloodSets = rawSets.map((s, idx) => {
      const set = s as Record<string, unknown>;
      return {
        setNo: idx + 1,
        drawSite: typeof set.drawSite === "string" ? set.drawSite : "",
        lumenLabel:
          typeof set.lumenLabel === "string" && set.lumenLabel ? set.lumenLabel : undefined,
        bottleTypes: Array.isArray(set.bottleTypes) ? (set.bottleTypes as string[]) : [],
        drawTime: typeof set.drawTime === "string" && set.drawTime ? set.drawTime : undefined,
      };
    });
  }

  return {
    accessionNumber: accession.accessionNumber,
    releaseState: accession.release.state,
    reportVersion: accession.release.reportVersion,
    patient: {
      name: `${accession.patient.givenName} ${accession.patient.familyName}`,
      mrn: accession.patient.mrn,
      sex: accession.patient.sex,
      ward: accession.patient.ward,
    },
    specimen: {
      display: profile?.displayName ?? accession.specimen.subtypeCode,
      syndrome: profile?.syndrome ?? undefined,
      pathway: profile?.gating.pathway ?? "diagnostic",
    },
    bloodSets,
    microscopySummary,
    isolates,
    comments,
    ipc: clinicianIPC,
    internalNotes: internalIpcNotes,
    versions: {
      rule: accession.ruleVersion,
      breakpoint: accession.breakpointVersion,
      export: accession.exportVersion,
      build: accession.buildVersion,
    },
    generatedAt: new Date().toISOString(),
  };
}
