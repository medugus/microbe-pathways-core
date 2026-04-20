// Export engine — pure, framework-agnostic, client-side only.
//
// Generates three governed payloads from a released Accession:
//  - FHIR R4 DiagnosticReport bundle (JSON)
//  - HL7 v2.5 ORU^R01 message (text)
//  - Normalised JSON snapshot
//
// All formats read from the FROZEN ReleasePackage when present (so the export
// is reproducible and version-pinned). Suppressed/restricted AST rows obey
// the stewardship visibility rules already encoded in the report preview.

import type { Accession } from "../domain/types";
import { ReleaseState } from "../domain/enums";
import { buildReportPreview, type ReportPreviewDoc } from "./reportPreview";
import { runValidation } from "./validationEngine";
import { hl7Escape, hl7Segment, hl7Ts } from "../utils/exportHelpers";

export type ExportFormat = "fhir" | "hl7" | "json";

export interface ExportGate {
  available: boolean;
  reason?: string;
  /** True when an immutable ReleasePackage exists and is the source. */
  fromReleasePackage: boolean;
  versions: { rule: string; breakpoint: string; export: string; build: string };
}

export interface ExportPayload {
  format: ExportFormat;
  filename: string;
  mime: string;
  content: string;
  gate: ExportGate;
}

// ---------- Gating ----------

export function evaluateExportGate(accession: Accession): ExportGate {
  const versions = {
    rule: accession.releasePackage?.ruleVersion ?? accession.ruleVersion,
    breakpoint: accession.releasePackage?.breakpointVersion ?? accession.breakpointVersion,
    export: accession.releasePackage?.exportVersion ?? accession.exportVersion,
    build: accession.releasePackage?.buildVersion ?? accession.buildVersion,
  };
  // Released states are exportable from the frozen package.
  if (
    accession.release.state === ReleaseState.Released ||
    accession.release.state === ReleaseState.Amended
  ) {
    if (!accession.releasePackage) {
      return {
        available: false,
        reason: "Released state but no frozen ReleasePackage — cannot export.",
        fromReleasePackage: false,
        versions,
      };
    }
    return { available: true, fromReleasePackage: true, versions };
  }
  // Pre-release: only allow if validation has no blockers (preview export).
  const v = runValidation(accession);
  if (!v.releaseAllowed) {
    return {
      available: false,
      reason: `Export blocked by ${v.blockers.length} validation blocker(s): ${v.blockers
        .map((b) => b.code)
        .join(", ")}.`,
      fromReleasePackage: false,
      versions,
    };
  }
  return {
    available: false,
    reason: "Report not yet released — release first to produce a versioned export.",
    fromReleasePackage: false,
    versions,
  };
}

// ---------- Source projection ----------

/** Use the frozen ReleasePackage body when available; otherwise a live preview. */
function sourceDoc(accession: Accession): ReportPreviewDoc {
  if (accession.releasePackage?.body) {
    return accession.releasePackage.body as ReportPreviewDoc;
  }
  return buildReportPreview(accession);
}

// ---------- FHIR R4 ----------

interface FhirResource {
  resourceType: string;
  id: string;
  [k: string]: unknown;
}

function sirToFhirInterp(s?: string): string {
  switch (s) {
    case "S": return "S";
    case "I": return "I";
    case "R": return "R";
    case "SDD": return "SDD";
    case "NS": return "NS";
    default: return "IND";
  }
}

export function buildFhirBundle(accession: Accession): unknown {
  const doc = sourceDoc(accession);
  const patientId = `pat-${accession.patient.mrn}`;
  const specimenId = `spc-${accession.id}`;
  const reportId = `dr-${accession.id}-v${doc.reportVersion}`;

  const resources: FhirResource[] = [];

  resources.push({
    resourceType: "Patient",
    id: patientId,
    identifier: [{ system: "urn:mrn", value: accession.patient.mrn }],
    name: [{ family: accession.patient.familyName, given: [accession.patient.givenName] }],
    gender: accession.patient.sex,
    birthDate: accession.patient.dob,
  });

  resources.push({
    resourceType: "Specimen",
    id: specimenId,
    subject: { reference: `Patient/${patientId}` },
    type: {
      coding: [
        { system: "urn:medugu:specimen-family", code: accession.specimen.familyCode },
        { system: "urn:medugu:specimen-subtype", code: accession.specimen.subtypeCode },
      ],
      text: doc.specimen.display,
    },
    receivedTime: accession.specimen.receivedAt,
    collection: { collectedDateTime: accession.specimen.collectedAt },
  });

  const observationRefs: { reference: string }[] = [];

  for (const iso of doc.isolates) {
    const isoObsId = `obs-iso-${accession.id}-${iso.isolateNo}`;
    resources.push({
      resourceType: "Observation",
      id: isoObsId,
      status: "final",
      category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "laboratory" }] }],
      code: { text: "Organism identified" },
      subject: { reference: `Patient/${patientId}` },
      specimen: { reference: `Specimen/${specimenId}` },
      valueCodeableConcept: {
        text: iso.organismDisplay,
        coding: [{ system: "urn:medugu:organism", code: accession.isolates[iso.isolateNo - 1]?.organismCode ?? "UNK" }],
      },
      component: [
        { code: { text: "Significance" }, valueString: iso.significance ?? "indeterminate" },
        { code: { text: "Growth" }, valueString: iso.growth ?? "—" },
        ...(iso.phenotypeFlags.length
          ? [{ code: { text: "Phenotypes" }, valueString: iso.phenotypeFlags.join(",") }]
          : []),
      ],
    });
    observationRefs.push({ reference: `Observation/${isoObsId}` });

    for (let i = 0; i < iso.ast.length; i++) {
      const a = iso.ast[i];
      const astObsId = `obs-ast-${accession.id}-${iso.isolateNo}-${a.antibioticCode}`;
      const visible = a.visibleToClinician !== false;
      resources.push({
        resourceType: "Observation",
        id: astObsId,
        status: "final",
        category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "laboratory" }] }],
        code: {
          text: `${a.antibioticDisplay} susceptibility`,
          coding: [{ system: "urn:medugu:antibiotic", code: a.antibioticCode }],
        },
        subject: { reference: `Patient/${patientId}` },
        specimen: { reference: `Specimen/${specimenId}` },
        derivedFrom: [{ reference: `Observation/${isoObsId}` }],
        method: { text: a.method },
        valueCodeableConcept: visible
          ? { text: sirToFhirInterp(a.interpretation) }
          : { text: "WITHHELD" },
        ...(a.rawValue !== undefined
          ? { component: [{ code: { text: "Raw" }, valueQuantity: { value: a.rawValue, unit: a.rawUnit } }] }
          : {}),
        note: !visible
          ? [{ text: a.suppressionReason ?? "Suppressed by stewardship/cascade rule." }]
          : a.releaseClass
            ? [{ text: `Release class: ${a.releaseClass}; AWaRe: ${a.aware ?? "NA"}.` }]
            : undefined,
      });
      if (visible) observationRefs.push({ reference: `Observation/${astObsId}` });
    }
  }

  const isAmendment = accession.release.state === ReleaseState.Amended;
  const amendmentReason = accession.release.amendmentReason;
  const amendmentExtensions = isAmendment
    ? [
        {
          url: "urn:medugu:amendment-reason",
          valueString: amendmentReason ?? "(no reason recorded)",
        },
        {
          url: "urn:medugu:supersedes-version",
          valueInteger: Math.max(1, doc.reportVersion - 1),
        },
      ]
    : [];

  resources.push({
    resourceType: "DiagnosticReport",
    id: reportId,
    meta: isAmendment
      ? { tag: [{ system: "urn:medugu:report-tag", code: "amended", display: "Amended report" }] }
      : undefined,
    status: isAmendment ? "amended" : "final",
    category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0074", code: "MB" }] }],
    code: { text: `Microbiology report v${doc.reportVersion}${isAmendment ? " (amended)" : ""}` },
    subject: { reference: `Patient/${patientId}` },
    specimen: [{ reference: `Specimen/${specimenId}` }],
    issued: accession.releasedAt ?? new Date().toISOString(),
    result: observationRefs,
    conclusion:
      [
        isAmendment ? `[amendment] ${amendmentReason ?? "Amended without recorded reason."}` : null,
        ...doc.comments.map((c) => `[${c.source}] ${c.text}`),
      ]
        .filter(Boolean)
        .join("\n") || undefined,
    extension: [
      { url: "urn:medugu:rule-version", valueString: doc.versions.rule },
      { url: "urn:medugu:breakpoint-version", valueString: doc.versions.breakpoint },
      { url: "urn:medugu:export-version", valueString: doc.versions.export },
      { url: "urn:medugu:build-version", valueString: doc.versions.build },
      ...amendmentExtensions,
    ],
  });

  return {
    resourceType: "Bundle",
    id: `bundle-${accession.id}-v${doc.reportVersion}`,
    type: "collection",
    timestamp: new Date().toISOString(),
    entry: resources.map((r) => ({
      fullUrl: `urn:uuid:${r.resourceType}/${r.id}`,
      resource: r,
    })),
  };
}

// ---------- HL7 v2.5 ORU^R01 ----------

export function buildHL7(accession: Accession): string {
  const doc = sourceDoc(accession);
  const ts = hl7Ts(accession.releasedAt ?? new Date().toISOString());
  const ctrlId = `${accession.id}-v${doc.reportVersion}`;

  const segments: string[] = [];
  segments.push(
    hl7Segment("MSH", [
      "^~\\&",
      "MEDUGU",
      "LAB",
      "RECV",
      "RECV_FAC",
      ts,
      "",
      "ORU^R01",
      ctrlId,
      "P",
      "2.5",
    ]),
  );

  segments.push(
    hl7Segment("PID", [
      "1",
      "",
      hl7Escape(accession.patient.mrn),
      "",
      `${hl7Escape(accession.patient.familyName)}^${hl7Escape(accession.patient.givenName)}`,
      "",
      hl7Escape(accession.patient.dob ?? ""),
      hl7Escape(accession.patient.sex),
    ]),
  );

  if (accession.patient.ward) {
    segments.push(
      hl7Segment("PV1", [
        "1",
        "I",
        `${hl7Escape(accession.patient.ward)}^^^`,
        "",
        "",
        "",
        hl7Escape(accession.patient.attendingClinician ?? ""),
      ]),
    );
  }

  const isAmendmentMsg = accession.release.state === ReleaseState.Amended;
  segments.push(
    hl7Segment("OBR", [
      "1",
      hl7Escape(accession.accessionNumber),
      hl7Escape(accession.accessionNumber),
      `MICRO^Microbiology report^L`,
      "",
      hl7Ts(accession.specimen.collectedAt),
      hl7Ts(accession.specimen.receivedAt),
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      ts,
      "",
      isAmendmentMsg ? "C" : "F",
    ]),
  );

  // Amendment notice immediately under OBR so receivers process it before OBX rows.
  if (isAmendmentMsg) {
    const supersedes = Math.max(1, doc.reportVersion - 1);
    segments.push(
      hl7Segment("NTE", [
        "0",
        "L",
        hl7Escape(
          `*** AMENDED REPORT *** v${doc.reportVersion} supersedes v${supersedes}. Reason: ${
            accession.release.amendmentReason ?? "(no reason recorded)"
          }`,
        ),
      ]),
    );
  }

  let setId = 1;
  for (const iso of doc.isolates) {
    segments.push(
      hl7Segment("OBX", [
        String(setId++),
        "ST",
        `ORG-${iso.isolateNo}^Organism identified^L`,
        String(iso.isolateNo),
        hl7Escape(iso.organismDisplay),
        "",
        "",
        "",
        "",
        "",
        "F",
      ]),
    );
    if (iso.phenotypeFlags.length) {
      segments.push(
        hl7Segment("NTE", [
          String(setId),
          "L",
          hl7Escape(`Phenotype flags: ${iso.phenotypeFlags.join(", ")}`),
        ]),
      );
    }
    for (const a of iso.ast) {
      const visible = a.visibleToClinician !== false;
      segments.push(
        hl7Segment("OBX", [
          String(setId++),
          a.rawValue !== undefined ? "NM" : "ST",
          `AST-${a.antibioticCode}^${hl7Escape(a.antibioticDisplay)} susceptibility^L`,
          `${iso.isolateNo}.${a.antibioticCode}`,
          visible ? hl7Escape(a.interpretation ?? "IND") : "WITHHELD",
          a.rawUnit ?? "",
          "",
          "",
          "",
          "",
          "F",
        ]),
      );
      if (!visible && a.suppressionReason) {
        segments.push(
          hl7Segment("NTE", [
            String(setId),
            "L",
            hl7Escape(`Result withheld: ${a.suppressionReason}`),
          ]),
        );
      } else if (a.releaseClass) {
        segments.push(
          hl7Segment("NTE", [
            String(setId),
            "L",
            hl7Escape(`Release class: ${a.releaseClass}; AWaRe: ${a.aware ?? "NA"}`),
          ]),
        );
      }
    }
  }

  for (const c of doc.comments) {
    segments.push(
      hl7Segment("NTE", [String(setId), "L", hl7Escape(`[${c.source}] ${c.text}`)]),
    );
  }

  segments.push(
    hl7Segment("NTE", [
      String(setId),
      "L",
      hl7Escape(
        `Versions: rule=${doc.versions.rule}; breakpoint=${doc.versions.breakpoint}; export=${doc.versions.export}; build=${doc.versions.build}.`,
      ),
    ]),
  );

  return segments.join("\r");
}

// ---------- Normalised JSON ----------

export interface NormalisedExport {
  schema: "medugu.normalised/1";
  exportedAt: string;
  versions: ReportPreviewDoc["versions"];
  releaseState: string;
  reportVersion: number;
  /**
   * Correction block (HL7 OBR-25=C / FHIR DiagnosticReport.status=amended).
   * Present and `isCorrection: true` when this export represents an amendment;
   * receivers should treat it as a correction superseding `supersedesVersion`.
   */
  correction: {
    isCorrection: boolean;
    supersedesVersion?: number;
    reason?: string;
  };
  patient: Accession["patient"];
  accession: {
    id: string;
    accessionNumber: string;
    workflowStatus: string;
    priority: string;
    createdAt: string;
    releasedAt?: string;
  };
  specimen: Accession["specimen"] & { display: string; pathway: string; syndrome?: string };
  isolates: ReportPreviewDoc["isolates"];
  ast: {
    isolateNo: number;
    antibioticCode: string;
    antibioticDisplay: string;
    method: string;
    rawValue?: number;
    rawUnit?: string;
    interpretation?: string;
    governance: string;
    visibleToClinician: boolean;
    suppressionReason?: string;
    releaseClass?: string;
    aware?: string;
    phenotypeFlags?: string[];
  }[];
  stewardship: { source: string; code: string; text: string }[];
  ipc: { ruleCode: string; message: string; actions: string[]; timing: string }[];
  validation: { code: string; severity: string; message: string; section: string }[];
  release: {
    state: string;
    reportVersion: number;
    releasedAt?: string;
    releasedBy?: string;
    amendmentReason?: string;
    consultantApproval?: { approvedBy: string; approvedAt: string; reason?: string };
    fromReleasePackage: boolean;
  };
}

export function buildNormalisedJson(accession: Accession): NormalisedExport {
  const doc = sourceDoc(accession);
  const v = runValidation(accession);
  const flatAst = doc.isolates.flatMap((iso) =>
    iso.ast.map((a) => ({
      isolateNo: iso.isolateNo,
      antibioticCode: a.antibioticCode,
      antibioticDisplay: a.antibioticDisplay,
      method: a.method,
      rawValue: a.rawValue,
      rawUnit: a.rawUnit,
      interpretation: a.interpretation,
      governance: a.governance,
      visibleToClinician: a.visibleToClinician,
      suppressionReason: a.suppressionReason,
      releaseClass: a.releaseClass,
      aware: a.aware,
      phenotypeFlags: a.phenotypeFlags,
    })),
  );
  const isAmendment = accession.release.state === ReleaseState.Amended;
  return {
    schema: "medugu.normalised/1",
    exportedAt: new Date().toISOString(),
    versions: doc.versions,
    releaseState: accession.release.state,
    reportVersion: doc.reportVersion,
    correction: {
      isCorrection: isAmendment,
      supersedesVersion: isAmendment ? Math.max(1, doc.reportVersion - 1) : undefined,
      reason: isAmendment ? accession.release.amendmentReason : undefined,
    },
    patient: accession.patient,
    accession: {
      id: accession.id,
      accessionNumber: accession.accessionNumber,
      workflowStatus: accession.workflowStatus,
      priority: accession.priority,
      createdAt: accession.createdAt,
      releasedAt: accession.releasedAt,
    },
    specimen: {
      ...accession.specimen,
      display: doc.specimen.display,
      pathway: doc.specimen.pathway,
      syndrome: doc.specimen.syndrome,
    },
    isolates: doc.isolates,
    ast: flatAst,
    stewardship: doc.comments.filter((c) => c.source === "stewardship").map((c) => ({ source: c.source, code: c.code, text: c.text })),
    ipc: doc.ipc,
    validation: v.issues.map((i) => ({ code: i.code, severity: i.severity, message: i.message, section: i.section })),
    release: {
      state: accession.release.state,
      reportVersion: accession.release.reportVersion,
      releasedAt: accession.releasedAt,
      releasedBy: accession.releasingActor,
      amendmentReason: accession.release.amendmentReason,
      consultantApproval: accession.release.consultantApproval,
      fromReleasePackage: !!accession.releasePackage,
    },
  };
}

// ---------- Top-level builder ----------

export function buildExport(accession: Accession, format: ExportFormat): ExportPayload {
  const gate = evaluateExportGate(accession);
  const v = doc(accession);
  const base = `${accession.accessionNumber}_v${v.reportVersion}`;
  if (format === "fhir") {
    const bundle = buildFhirBundle(accession);
    return {
      format,
      filename: `${base}.fhir.json`,
      mime: "application/fhir+json",
      content: JSON.stringify(bundle, null, 2),
      gate,
    };
  }
  if (format === "hl7") {
    return {
      format,
      filename: `${base}.hl7`,
      mime: "application/hl7-v2",
      content: buildHL7(accession),
      gate,
    };
  }
  return {
    format,
    filename: `${base}.json`,
    mime: "application/json",
    content: JSON.stringify(buildNormalisedJson(accession), null, 2),
    gate,
  };
}

function doc(accession: Accession): ReportPreviewDoc {
  return sourceDoc(accession);
}
