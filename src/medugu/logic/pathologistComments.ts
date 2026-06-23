import type {
  Accession,
  ASTResult,
  Isolate,
  PathologistReportComment,
  ReleaseSignOff,
} from "../domain/types";
import { getAntibiotic } from "../config/antibiotics";
import { getOrganism } from "../config/organisms";
import { approvalStatusForRow, isRestrictedRow } from "./amsEngine";
import {
  BV_SCREEN_DETAIL_KEY,
  evaluateBacterialVaginosisScreen,
  isBacterialVaginosisScreenSpecimen,
  normaliseBvScreenInput,
} from "./bacterialVaginosis";

export interface PathologistCommentSuggestion {
  text: string;
  scenarioCodes: string[];
}

const CARBAPENEMS = new Set(["MEM", "IPM", "ETP", "DOR"]);
const THIRD_GENERATION_CEPHALOSPORINS = new Set(["CRO", "CTX", "CAZ", "CFM"]);
const MRSA_MARKERS = new Set(["FOX", "OXA"]);
const NON_REPORTABLE_ORGANISMS = new Set(["NOGRO", "MIXED", "NORML"]);

function finalSir(row: ASTResult): string | undefined {
  return row.finalInterpretation ?? row.interpretedSIR ?? row.rawInterpretation;
}

function isResistant(row?: ASTResult): boolean {
  return finalSir(row) === "R";
}

function isSusceptible(row?: ASTResult): boolean {
  return finalSir(row) === "S";
}

function rowsFor(accession: Accession, isolateId: string): ASTResult[] {
  return accession.ast.filter((row) => row.isolateId === isolateId);
}

function hasPhenotype(rows: ASTResult[], phenotype: string): boolean {
  return rows.some((row) => row.phenotypeFlags?.includes(phenotype)) || false;
}

function addUnique(list: string[], value: string) {
  if (!list.includes(value)) list.push(value);
}

function resistantClassCount(rows: ASTResult[]): number {
  const classes = new Set<string>();
  for (const row of rows) {
    if (!isResistant(row)) continue;
    const cls = getAntibiotic(row.antibioticCode)?.class;
    if (cls) classes.add(cls);
  }
  return classes.size;
}

function hasPendingRestrictedRows(accession: Accession): boolean {
  return accession.ast.some((row) => {
    if (!isRestrictedRow(row)) return false;
    const status = approvalStatusForRow(accession, row.id);
    return status !== "approved";
  });
}

function activeIsolates(accession: Accession): Isolate[] {
  return accession.isolates.filter(
    (isolate) => !NON_REPORTABLE_ORGANISMS.has(isolate.organismCode),
  );
}

export function buildPathologistCommentSuggestion(
  accession: Accession,
): PathologistCommentSuggestion {
  const scenarioCodes: string[] = [];
  const comments: string[] = [];
  const isolates = activeIsolates(accession);

  if (isolates.length === 0) {
    addUnique(scenarioCodes, "NO_SIGNIFICANT_GROWTH");
    comments.push(
      "No significant pathogen is reported from this specimen in the current culture work-up. Correlate with specimen quality, timing of collection and prior antimicrobial exposure.",
    );
  }

  if (accession.specimen.familyCode === "BLOOD" && isolates.length > 0) {
    addUnique(scenarioCodes, "BLOOD_CULTURE_POSITIVE");
    comments.push(
      "Positive blood culture result reviewed. Interpret organism significance with bottle pattern, time to positivity, source of draw, repeat cultures and the clinical syndrome.",
    );
  }

  if (accession.specimen.familyCode === "GENITAL") {
    addUnique(scenarioCodes, "GENITAL_TRACT_PROCESSING");
    comments.push(
      "Genital tract culture reviewed as a site-specific result: report recognised pathogens or targeted screen results, avoid over-reporting commensal flora, and correlate with STI NAAT/wet-prep findings where clinically indicated.",
    );

    if (
      isBacterialVaginosisScreenSpecimen(
        accession.specimen.familyCode,
        accession.specimen.subtypeCode,
      )
    ) {
      const bv = evaluateBacterialVaginosisScreen(
        normaliseBvScreenInput(accession.specimen.details?.[BV_SCREEN_DETAIL_KEY]),
      );
      if (bv.nugentInterpretation === "positive") {
        addUnique(scenarioCodes, "BV_NUGENT_POSITIVE");
        comments.push(
          "Bacterial vaginosis screen is positive by Nugent scoring. Report as a microscopy diagnosis rather than Gardnerella culture alone; correlate with symptoms and local treatment guidance.",
        );
      } else if (bv.nugentInterpretation === "intermediate") {
        addUnique(scenarioCodes, "BV_NUGENT_INTERMEDIATE");
        comments.push(
          "Bacterial vaginosis screen shows intermediate vaginal flora by Nugent scoring. Correlate with Amsel/clinical findings where available.",
        );
      }
    }
  }

  if (accession.specimen.familyCode === "COLONISATION") {
    addUnique(scenarioCodes, "COLONISATION_SCREEN");
    comments.push(
      "Colonisation-screen result reviewed against the selected screen pathway. Positive target organisms and negative screen outcomes should be interpreted only within that screening context.",
    );
  }

  for (const isolate of isolates) {
    const organism = getOrganism(isolate.organismCode);
    const rows = rowsFor(accession, isolate.id);

    if (
      isolate.organismCode === "SAUR" &&
      (rows.some((row) => MRSA_MARKERS.has(row.antibioticCode) && isResistant(row)) ||
        hasPhenotype(rows, "MRSA"))
    ) {
      addUnique(scenarioCodes, "MRSA_PATTERN");
      comments.push(
        "Staphylococcus aureus with cefoxitin/oxacillin resistance is consistent with an MRSA phenotype; beta-lactam reporting and IPC visibility require final laboratory governance review.",
      );
    }

    if (
      organism?.group === "enterococcus" &&
      (rows.some((row) => row.antibioticCode === "VAN" && isResistant(row)) ||
        hasPhenotype(rows, "VRE"))
    ) {
      addUnique(scenarioCodes, "VRE_PATTERN");
      comments.push(
        "Vancomycin-resistant Enterococcus phenotype detected. Ensure IPC notification and stewardship visibility are complete before final clinical release.",
      );
    }

    if (
      organism?.group === "enterobacterales" &&
      rows.some((row) => CARBAPENEMS.has(row.antibioticCode) && isResistant(row))
    ) {
      addUnique(scenarioCodes, "CRO_ENTEROBACTERALES");
      comments.push(
        "Carbapenem-resistant Enterobacterales pattern detected. Confirm organism/AST consistency, complete IPC notification, and ensure any restricted antimicrobial rows are handled through AMS governance.",
      );
    }

    if (
      organism?.group === "non_fermenter" &&
      rows.some((row) => CARBAPENEMS.has(row.antibioticCode) && isResistant(row))
    ) {
      addUnique(scenarioCodes, "CRO_NON_FERMENTER");
      comments.push(
        "Carbapenem resistance is present in a non-fermenting Gram-negative organism. Confirm identification and susceptibility governance, and ensure IPC/AMS review has been actioned where required.",
      );
    }

    if (
      organism?.group === "enterobacterales" &&
      rows.some(
        (row) => THIRD_GENERATION_CEPHALOSPORINS.has(row.antibioticCode) && isResistant(row),
      ) &&
      rows.some((row) => CARBAPENEMS.has(row.antibioticCode) && isSusceptible(row))
    ) {
      addUnique(scenarioCodes, "ESBL_OR_AMPC_PATTERN");
      comments.push(
        "Third-generation cephalosporin resistance with retained carbapenem activity suggests an ESBL/AmpC-type pattern; review expert-rule suppression and selective-reporting decisions before release.",
      );
    }

    if (resistantClassCount(rows) >= 3) {
      addUnique(scenarioCodes, "MULTIDRUG_RESISTANCE");
      comments.push(
        "Multidrug resistance pattern detected across three or more antimicrobial classes. Reported susceptibilities should be reviewed for phenotype consistency and stewardship restrictions.",
      );
    }

    if (isolate.organismCode === "CAUR") {
      addUnique(scenarioCodes, "CANDIDA_AURIS");
      comments.push(
        "Candida auris detected or suspected. Ensure urgent IPC notification, isolation/environmental control workflow and local confirmatory identification policy are complete.",
      );
    }
  }

  if (hasPendingRestrictedRows(accession)) {
    addUnique(scenarioCodes, "AMS_RESTRICTED_ROWS_PENDING");
    comments.push(
      "One or more restricted antimicrobial results remain withheld from the clinician-facing report pending AMS approval; an amendment is required if those rows are later authorised for release.",
    );
  }

  if (comments.length === 0) {
    addUnique(scenarioCodes, "ROUTINE_CULTURE_REVIEW");
    comments.push(
      "Culture and susceptibility results reviewed. Interpret alongside specimen quality, clinical syndrome, prior antimicrobial exposure and local antimicrobial guidance.",
    );
  }

  return {
    text: comments.join("\n\n"),
    scenarioCodes,
  };
}

export function pathologistCommentForReport(accession: Accession): PathologistReportComment {
  const suggestion = buildPathologistCommentSuggestion(accession);
  const stored = accession.release.pathologistComment;
  if (stored?.text?.trim()) return stored;
  const now = new Date().toISOString();
  return {
    text: suggestion.text,
    generatedText: suggestion.text,
    scenarioCodes: suggestion.scenarioCodes,
    generatedAt: now,
    updatedAt: now,
    updatedBy: "auto",
    edited: false,
  };
}

export function signOffLabel(signOff: ReleaseSignOff | undefined, emptyLabel: string): string {
  if (!signOff) return `${emptyLabel}: ______________________________`;
  const at = new Date(signOff.signedAt);
  const when = Number.isNaN(at.getTime()) ? signOff.signedAt : at.toLocaleString();
  return `${emptyLabel}: ${signOff.signedBy} (${when})`;
}
