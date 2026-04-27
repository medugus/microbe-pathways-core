import type { Accession } from "../../domain/types";
import { ReleaseState } from "../../domain/enums";
import { hl7Escape, hl7Segment, hl7Ts } from "../../utils/exportHelpers";
import { sourceDoc } from "./exportUtils";

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

  // Per-set blood culture details — labelled draws appear under OBR before isolate OBX rows.
  if (doc.bloodSets && doc.bloodSets.length > 0) {
    for (const s of doc.bloodSets) {
      segments.push(
        hl7Segment("NTE", [
          "0",
          "L",
          hl7Escape(
            `Blood culture set ${s.setNo}: site=${s.drawSite || "—"}${s.lumenLabel ? `; lumen=${s.lumenLabel}` : ""}; bottles=${s.bottleTypes.join(",") || "—"}${s.drawTime ? `; drawn=${s.drawTime}` : ""}`,
          ),
        ]),
      );
    }
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
    if (iso.bloodSourceLinks && iso.bloodSourceLinks.length > 0) {
      segments.push(
        hl7Segment("NTE", [
          String(setId),
          "L",
          hl7Escape(
            `Source linkage: ${iso.bloodSourceLinks
              .map((l) => `set ${l.setNo} ${l.bottleType}`)
              .join("; ")}`,
          ),
        ]),
      );
    }
    if (iso.significance) {
      segments.push(
        hl7Segment("NTE", [String(setId), "L", hl7Escape(`Significance: ${iso.significance}`)]),
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
    segments.push(hl7Segment("NTE", [String(setId), "L", hl7Escape(`[${c.source}] ${c.text}`)]));
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
