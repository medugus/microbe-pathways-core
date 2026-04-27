import { amsAcceptanceScenarioCases } from "../../fixtures/amsAcceptanceCases";
import type { Accession } from "../../domain/types";
import { runValidation } from "../validationEngine";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const accession: Accession = clone(amsAcceptanceScenarioCases.noAmsActionCase);
accession.id = "VAL-AST-PLACEHOLDER-001";
accession.accessionNumber = "MB26-VALAST001";
accession.patient.mrn = "12345";
accession.patient.familyName = "Patient";
accession.specimen.familyCode = "URINE";
accession.specimen.subtypeCode = "URINE_MIDSTREAM";
accession.isolates = [
  {
    id: "iso_val_1",
    isolateNo: 1,
    organismCode: "ECOL",
    organismDisplay: "Escherichia coli",
    significance: "significant",
  },
];
accession.ast = [
  {
    id: "ast_blank_placeholder",
    isolateId: "iso_val_1",
    antibioticCode: "CRO",
    method: "disk_diffusion",
    standard: "CLSI",
    governance: "draft",
    cascade: "primary",
  },
  {
    id: "ast_started_incomplete",
    isolateId: "iso_val_1",
    antibioticCode: "AMP",
    method: "disk_diffusion",
    standard: "CLSI",
    rawValue: 9,
    rawUnit: "mm",
    rawInterpretation: "R",
    interpretedSIR: "R",
    governance: "interpreted",
    cascade: "primary",
  },
];

const report = runValidation(accession);
const astIncompleteMessages = report.blockers
  .filter((issue) => issue.code === "AST_INCOMPLETE")
  .map((issue) => issue.message);

assert(
  astIncompleteMessages.some((message) => message.includes("AMP")),
  "Started AST row without final interpretation must still block release.",
);
assert(
  !astIncompleteMessages.some((message) => message.includes("CRO")),
  "Blank placeholder AST row must not create AST_INCOMPLETE blocker.",
);

// eslint-disable-next-line no-console
console.log("[validationEngine.astPlaceholders.test] all assertions passed");
