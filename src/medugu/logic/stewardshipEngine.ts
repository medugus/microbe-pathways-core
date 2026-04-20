// Stewardship engine — pure.
// Determines per-AST-row release class, AWaRe category, route bias, and
// whether a row should remain hidden from clinician release until approval
// conditions are satisfied.

import type { ASTResult, Accession, Isolate, StewardshipNote } from "../domain/types";
import { resolveSpecimen } from "./specimenResolver";
import {
  getStewardship,
  getSyndromePref,
  type AWaRe,
  type ReleaseClass,
} from "../config/stewardshipRules";
import { newId } from "../domain/ids";
import { approvalStatusForRow, isRestrictedRow } from "./amsEngine";

export interface StewardshipDecision {
  astId: string;
  antibioticCode: string;
  isolateId: string;
  releaseClass: ReleaseClass;
  aware: AWaRe;
  /** Whether this row is hidden from the clinician-facing report. */
  visibleToClinician: boolean;
  /** Reason rendered alongside suppressed rows so users understand why. */
  suppressionReason?: string;
  /** Approval requirement: when true, row is hidden until approval is granted. */
  approvalRequired: boolean;
  /** Computed advisory note (de-escalation, IV→PO, syndrome guidance). */
  advisory?: string;
}

export interface StewardshipReport {
  decisions: StewardshipDecision[];
  notes: StewardshipNote[];
  /** Convenient lookup by AST row id. */
  byAst: Record<string, StewardshipDecision>;
}

const nowIso = () => new Date().toISOString();

export function evaluateStewardship(accession: Accession): StewardshipReport {
  const r = resolveSpecimen(accession.specimen.familyCode, accession.specimen.subtypeCode);
  const profile = r.ok ? r.profile : null;
  const syndromePref = getSyndromePref(profile?.syndrome ?? null);

  const decisions: StewardshipDecision[] = [];
  const notes: StewardshipNote[] = [];

  for (const row of accession.ast) {
    const iso = accession.isolates.find((i) => i.id === row.isolateId);
    const sw = getStewardship(row.antibioticCode);
    const aware: AWaRe = sw?.aware ?? "NotClassified";
    let releaseClass: ReleaseClass = sw?.defaultReleaseClass ?? "unrestricted";
    let visibleToClinician = true;
    let suppressionReason: string | undefined;
    let approvalRequired = false;
    let advisory: string | undefined;

    // Syndrome-aware overrides
    if (syndromePref) {
      if (syndromePref.suppress.includes(row.antibioticCode)) {
        releaseClass = "cascade_suppressed";
        visibleToClinician = false;
        suppressionReason = `Suppressed for ${syndromePref.syndrome}: ${syndromePref.note}`;
      }
      if (syndromePref.prefer.includes(row.antibioticCode)) {
        advisory = `Preferred first-line for ${syndromePref.syndrome}.`;
      }
    }

    // Restricted agents require AMS approval before clinician release.
    // Browser-phase Stage 6: consult amsApprovals on the accession.
    if (releaseClass === "restricted" || isRestrictedRow(row)) {
      const amsStatus = approvalStatusForRow(accession, row.id);
      if (amsStatus === "approved") {
        approvalRequired = false;
        // Released for clinician view because AMS pharmacist approved.
        // visibleToClinician stays true unless suppressed for other reasons.
      } else {
        approvalRequired = true;
        visibleToClinician = false;
        const stateLabel =
          amsStatus === "pending" ? "approval pending"
          : amsStatus === "denied" ? "approval denied"
          : amsStatus === "expired" ? "approval expired"
          : "approval not requested";
        suppressionReason = suppressionReason ?? `Restricted agent (${aware}) — AMS ${stateLabel}.`;
      }
    }

    // Phenotype-driven cascade suppression already encoded on the row
    if (row.cascadeDecision === "suppressed_by_phenotype") {
      visibleToClinician = false;
      suppressionReason = row.stewardshipNote ?? "Suppressed by phenotype rule.";
    }
    if (row.cascadeDecision === "hidden_until_promoted") {
      visibleToClinician = false;
      suppressionReason = suppressionReason ?? "Cascade-tier agent — hidden until first-line resistance is confirmed.";
    }

    // Screen pathway: never release AST clinically
    if (profile?.gating.pathway === "screen") {
      visibleToClinician = false;
      suppressionReason = "Screening specimen — antimicrobial guidance not reported clinically.";
      releaseClass = "screening_only";
    }

    // IV→PO de-escalation hint
    if (sw?.oralAvailable && row.finalInterpretation === "S") {
      advisory = advisory
        ? `${advisory} Oral formulation available — consider IV→PO switch.`
        : "Oral formulation available — consider IV→PO switch.";
    }

    decisions.push({
      astId: row.id,
      antibioticCode: row.antibioticCode,
      isolateId: row.isolateId,
      releaseClass,
      aware,
      visibleToClinician,
      suppressionReason,
      approvalRequired,
      advisory,
    });

    if (advisory || suppressionReason) {
      notes.push({
        id: newId("sw"),
        flag: approvalRequired ? "restricted_agent" : "de_escalation_candidate",
        message:
          (suppressionReason ? `[${row.antibioticCode}] ${suppressionReason}` : "") +
          (advisory ? ` ${advisory}` : ""),
        raisedAt: nowIso(),
      });
    }

    void iso;
  }

  // Bug-drug mismatch (simple heuristic): any row marked R but listed as preferred.
  if (syndromePref) {
    for (const code of syndromePref.prefer) {
      const matching = accession.ast.filter((a) => a.antibioticCode === code && (a.finalInterpretation === "R" || a.interpretedSIR === "R"));
      if (matching.length > 0) {
        notes.push({
          id: newId("sw"),
          flag: "bug_drug_mismatch",
          message: `Preferred first-line ${code} resistant — escalate per ${syndromePref.syndrome} pathway.`,
          raisedAt: nowIso(),
        });
      }
    }
  }

  const byAst: Record<string, StewardshipDecision> = {};
  for (const d of decisions) byAst[d.astId] = d;

  return { decisions, notes, byAst };
}

export function isAstApproved(row: ASTResult): boolean {
  return row.governance === "approved" || row.governance === "released";
}

export function isolateOfRow(accession: Accession, row: ASTResult): Isolate | undefined {
  return accession.isolates.find((i) => i.id === row.isolateId);
}
