// Live report preview — clinician-facing structured projection.
// Pure; reads accession state and returns a typed document. Rendering is in UI.
// No copy-paste workflow: every value is governed by accession state.

import type { Accession } from "../domain/types";
import { resolveSpecimen } from "./specimenResolver";
import { getAntibiotic } from "../config/antibiotics";

export type CommentSource = "clinical" | "stewardship" | "ipc";

export interface ReportComment {
  source: CommentSource;
  code: string;
  text: string;
}

export interface ReportASTRow {
  antibioticCode: string;
  antibioticDisplay: string;
  method: string;
  rawValue?: number;
  rawUnit?: string;
  interpretation?: string;
  governance: string;
}

export interface ReportIsolate {
  isolateNo: number;
  organismDisplay: string;
  significance?: string;
  growth?: string;
  ast: ReportASTRow[];
}

export interface ReportPreviewDoc {
  accessionNumber: string;
  releaseState: string;
  reportVersion: number;
  patient: { name: string; mrn: string; sex: string; ward?: string };
  specimen: { display: string; syndrome?: string; pathway: string };
  microscopySummary: string;
  isolates: ReportIsolate[];
  comments: ReportComment[];
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

  const isolates: ReportIsolate[] = accession.isolates.map((i) => ({
    isolateNo: i.isolateNo,
    organismDisplay: i.organismDisplay,
    significance: i.significance,
    growth:
      i.colonyCountCfuPerMl !== undefined
        ? `${i.colonyCountCfuPerMl.toExponential(0)} CFU/mL`
        : i.growthQuantifierCode,
    ast: accession.ast
      .filter((a) => a.isolateId === i.id)
      .map<ReportASTRow>((a) => ({
        antibioticCode: a.antibioticCode,
        antibioticDisplay: getAntibiotic(a.antibioticCode)?.display ?? a.antibioticCode,
        method: a.method,
        rawValue: a.rawValue,
        rawUnit: a.rawUnit,
        interpretation: a.finalInterpretation,
        governance: a.governance,
      })),
  }));

  // Structured comment placeholders by source.
  const comments: ReportComment[] = [];
  for (const c of accession.interpretiveComments) {
    const source: CommentSource =
      c.scope === "ast" ? "stewardship" : c.scope === "isolate" ? "clinical" : "clinical";
    comments.push({ source, code: c.code, text: c.text });
  }
  for (const s of accession.stewardship) {
    comments.push({ source: "stewardship", code: s.flag, text: s.message });
  }
  for (const ipc of accession.ipc) {
    comments.push({ source: "ipc", code: ipc.ruleCode, text: ipc.message });
  }

  const microscopySummary =
    accession.microscopy.length === 0
      ? "No microscopy recorded."
      : accession.microscopy
          .map((m) => `${m.stainCode}: ${m.result}${m.notes ? ` (${m.notes})` : ""}`)
          .join("; ");

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
    microscopySummary,
    isolates,
    comments,
    versions: {
      rule: accession.ruleVersion,
      breakpoint: accession.breakpointVersion,
      export: accession.exportVersion,
      build: accession.buildVersion,
    },
    generatedAt: new Date().toISOString(),
  };
}
