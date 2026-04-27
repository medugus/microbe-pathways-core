import { DEMO_ACCESSIONS } from "../../seed/demoAccessions";
import { buildExport, evaluateExportGate } from "../exportEngine";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const released = DEMO_ACCESSIONS.find((a) => a.id === "MB25-COL003P");
if (!released) throw new Error("Expected released demo accession MB25-COL003P.");

const fhir = buildExport(released, "fhir");
assert(fhir.content.length > 0, "FHIR export should be non-empty.");
assert(fhir.filename.endsWith(".fhir.json"), "FHIR filename suffix should be preserved.");
assert(
  fhir.content.includes(released.accessionNumber),
  "FHIR export should include accession identifier.",
);
assert(fhir.content.includes(released.patient.mrn), "FHIR export should include patient MRN.");

const hl7 = buildExport(released, "hl7");
assert(hl7.content.length > 0, "HL7 export should be non-empty.");
assert(hl7.filename.endsWith(".hl7"), "HL7 filename suffix should be preserved.");
assert(hl7.content.includes("MSH|"), "HL7 export should contain MSH segment.");
assert(
  hl7.content.includes(released.accessionNumber),
  "HL7 export should include accession identifier.",
);
assert(hl7.content.includes(released.patient.mrn), "HL7 export should include patient MRN.");

const normalised = buildExport(released, "json");
assert(normalised.content.length > 0, "Normalised JSON export should be non-empty.");
assert(normalised.filename.endsWith(".json"), "JSON filename suffix should be preserved.");
assert(
  normalised.content.includes(released.accessionNumber),
  "Normalised JSON export should include accession identifier.",
);
assert(
  normalised.content.includes(released.patient.mrn),
  "Normalised JSON export should include patient MRN.",
);

const unreleased = DEMO_ACCESSIONS.find((a) => a.id === "MB25-AB12CD");
if (!unreleased) throw new Error("Expected unreleased demo accession MB25-AB12CD.");

const gate = evaluateExportGate(unreleased);
assert(gate.available === false, "Unreleased export must remain unavailable.");
assert(
  gate.reason?.includes("Export blocked by") ||
    gate.reason?.includes("Report not yet released — release first to produce a versioned export."),
  "Unreleased export reason should follow existing gate contract.",
);

console.log("[exportEngine.test] all assertions passed");
