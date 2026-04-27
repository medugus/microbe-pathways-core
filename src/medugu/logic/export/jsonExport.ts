import type { Accession } from "../../domain/types";
import { ReleaseState } from "../../domain/enums";
import { runValidation } from "../validationEngine";
import type { NormalisedExport } from "./exportTypes";
import { sourceDoc } from "./exportUtils";

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

  // Build a stable, normalised blood-culture linkage block. We only emit it
  // when there is something to say (BLOOD specimen with at least one set or
  // one per-bottle row). Sorting is deterministic so the JSON is byte-stable
  // across runs and safe to seal/diff.
  let bloodLinkage: NormalisedExport["bloodLinkage"];
  const hasSets = !!(doc.bloodSets && doc.bloodSets.length > 0);
  const hasBottleRows = doc.isolates.some(
    (iso) => iso.bottleResults && iso.bottleResults.length > 0,
  );
  if (hasSets || hasBottleRows) {
    // Bottle inventory: union of (setNo, bottleType) declared on sets and
    // any (setNo, bottleType) referenced by isolate bottleResults. Set-level
    // metadata (drawSite, lumenLabel, drawTime) is denormalised onto each
    // bottle row so receivers do not need a second join.
    const setMeta = new Map<
      number,
      { drawSite?: string; lumenLabel?: string; drawTime?: string; bottleTypes: string[] }
    >();
    for (const s of doc.bloodSets ?? []) {
      setMeta.set(s.setNo, {
        drawSite: s.drawSite || undefined,
        lumenLabel: s.lumenLabel,
        drawTime: s.drawTime,
        bottleTypes: s.bottleTypes ?? [],
      });
    }

    type BottleKey = string;
    const keyOf = (setNo: number, bt: string): BottleKey => `${setNo}::${bt}`;
    const bottleRows = new Map<
      BottleKey,
      {
        setNo: number;
        bottleType: string;
        drawSite?: string;
        lumenLabel?: string;
        drawTime?: string;
        growth: string;
        positiveAt?: string;
        ttpHours?: number;
      }
    >();

    // Seed from declared sets so empty/no-growth bottles are still listed.
    for (const [setNo, meta] of setMeta.entries()) {
      for (const bt of meta.bottleTypes) {
        bottleRows.set(keyOf(setNo, bt), {
          setNo,
          bottleType: bt,
          drawSite: meta.drawSite,
          lumenLabel: meta.lumenLabel,
          drawTime: meta.drawTime,
          growth: "pending",
        });
      }
    }

    // Overlay per-bottle results from any isolate (last write wins per
    // bottle key — bottle-level growth/TTP is shared across isolates).
    for (const iso of doc.isolates) {
      for (const r of iso.bottleResults ?? []) {
        const meta = setMeta.get(r.setNo);
        const k = keyOf(r.setNo, r.bottleType);
        const existing = bottleRows.get(k);
        bottleRows.set(k, {
          setNo: r.setNo,
          bottleType: r.bottleType,
          drawSite: existing?.drawSite ?? meta?.drawSite,
          lumenLabel: existing?.lumenLabel ?? meta?.lumenLabel,
          drawTime: existing?.drawTime ?? meta?.drawTime,
          growth: r.growth,
          positiveAt: r.positiveAt,
          ttpHours: r.ttpHours,
        });
      }
    }

    const bottles = Array.from(bottleRows.values()).sort(
      (a, b) => a.setNo - b.setNo || a.bottleType.localeCompare(b.bottleType),
    );

    // Isolate→source link rows: one row per (isolateNo, setNo, bottleType).
    const isolateLinks: NonNullable<NormalisedExport["bloodLinkage"]>["isolateLinks"] = [];
    for (const iso of doc.isolates) {
      const src = accession.isolates.find((x) => x.isolateNo === iso.isolateNo);
      const organismCode = src?.organismCode ?? "UNK";
      for (const link of iso.bloodSourceLinks ?? []) {
        isolateLinks.push({
          isolateNo: iso.isolateNo,
          organismCode,
          organismDisplay: iso.organismDisplay,
          setNo: link.setNo,
          bottleType: link.bottleType,
        });
      }
    }
    isolateLinks.sort(
      (a, b) =>
        a.setNo - b.setNo || a.bottleType.localeCompare(b.bottleType) || a.isolateNo - b.isolateNo,
    );

    bloodLinkage = { bottles, isolateLinks };
  }

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
    bloodSets: doc.bloodSets,
    isolates: doc.isolates,
    bloodLinkage,
    ast: flatAst,
    stewardship: doc.comments
      .filter((c) => c.source === "stewardship")
      .map((c) => ({ source: c.source, code: c.code, text: c.text })),
    ipc: doc.ipc,
    validation: v.issues.map((i) => ({
      code: i.code,
      severity: i.severity,
      message: i.message,
      section: i.section,
    })),
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
