import type { Accession } from "../../domain/types";
import { ReleaseState } from "../../domain/enums";
import { sirToFhirInterp, sourceDoc } from "./exportUtils";

interface FhirResource {
  resourceType: string;
  id: string;
  [k: string]: unknown;
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
    extension:
      doc.bloodSets && doc.bloodSets.length > 0
        ? [
            {
              url: "urn:medugu:blood-culture-sets",
              extension: doc.bloodSets.map((s) => ({
                url: `set-${s.setNo}`,
                valueString: `Set ${s.setNo} | site=${s.drawSite || "—"}${s.lumenLabel ? ` | lumen=${s.lumenLabel}` : ""} | bottles=${s.bottleTypes.join(",") || "—"}${s.drawTime ? ` | drawn=${s.drawTime}` : ""}`,
              })),
            },
          ]
        : undefined,
  });

  const observationRefs: { reference: string }[] = [];

  for (const iso of doc.isolates) {
    const isoObsId = `obs-iso-${accession.id}-${iso.isolateNo}`;
    resources.push({
      resourceType: "Observation",
      id: isoObsId,
      status: "final",
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/observation-category",
              code: "laboratory",
            },
          ],
        },
      ],
      code: { text: "Organism identified" },
      subject: { reference: `Patient/${patientId}` },
      specimen: { reference: `Specimen/${specimenId}` },
      valueCodeableConcept: {
        text: iso.organismDisplay,
        coding: [
          {
            system: "urn:medugu:organism",
            code: accession.isolates[iso.isolateNo - 1]?.organismCode ?? "UNK",
          },
        ],
      },
      component: [
        { code: { text: "Significance" }, valueString: iso.significance ?? "indeterminate" },
        { code: { text: "Growth" }, valueString: iso.growth ?? "—" },
        ...(iso.phenotypeFlags.length
          ? [{ code: { text: "Phenotypes" }, valueString: iso.phenotypeFlags.join(",") }]
          : []),
        ...(iso.bloodSourceLinks && iso.bloodSourceLinks.length > 0
          ? [
              {
                code: { text: "Blood source linkage" },
                valueString: iso.bloodSourceLinks
                  .map((l) => `set${l.setNo}/${l.bottleType}`)
                  .join(", "),
              },
            ]
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
        category: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/observation-category",
                code: "laboratory",
              },
            ],
          },
        ],
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
          ? {
              component: [
                { code: { text: "Raw" }, valueQuantity: { value: a.rawValue, unit: a.rawUnit } },
              ],
            }
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
    category: [
      { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0074", code: "MB" }] },
    ],
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
