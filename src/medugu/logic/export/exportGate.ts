import type { Accession } from "../../domain/types";
import { ReleaseState } from "../../domain/enums";
import { runValidation } from "../validationEngine";
import type { ExportGate } from "./exportTypes";

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
