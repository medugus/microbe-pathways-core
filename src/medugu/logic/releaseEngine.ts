// Release engine — produces a frozen ReleasePackage snapshot.
// Once written into accession.releasePackage, later edits to the live accession
// must NOT mutate this snapshot (deep clone via JSON).

import type { Accession, ReleasePackage } from "../domain/types";
import { ReleaseState } from "../domain/enums";
import { runValidation } from "./validationEngine";
import { buildReportPreview } from "./reportPreview";
import { configStore } from "../store/configStore";

export interface ReleaseAttemptResult {
  ok: boolean;
  reason?: string;
  package?: ReleasePackage;
  nextReleaseState?: ReleaseState;
  nextReportVersion?: number;
}

export function attemptRelease(accession: Accession, _actor = "local"): ReleaseAttemptResult {
  const v = runValidation(accession);
  if (!v.releaseAllowed) {
    return { ok: false, reason: `Release blocked by ${v.blockers.length} blocker(s).` };
  }
  if (accession.release.state === ReleaseState.Released) {
    return { ok: false, reason: "Already released — use amendment flow." };
  }

  const preview = buildReportPreview(accession);
  // Deep-clone via JSON to guarantee the snapshot cannot be mutated when
  // the live accession changes downstream.
  const frozenBody = JSON.parse(JSON.stringify(preview));

  // Stage 7: pin the active config version into every release package.
  // The active config set is the source of truth for organisms / antibiotics /
  // breakpoints / IPC / stewardship rules at release time, so we tag the
  // package with `config-vN` alongside the existing rule/breakpoint/export
  // pins. This makes governed metadata propagation auditable and lets a
  // future backend swap in without changing the package contract.
  const configVersion = configStore.getActiveVersion();
  const nextVersion = (accession.release.reportVersion ?? 0) + 1;
  const pkg: ReleasePackage = {
    builtAt: new Date().toISOString(),
    version: nextVersion,
    body: frozenBody,
    ruleVersion: `${accession.ruleVersion}+config-v${configVersion}`,
    breakpointVersion: accession.breakpointVersion,
    exportVersion: accession.exportVersion,
    buildVersion: accession.buildVersion,
  };

  return {
    ok: true,
    package: pkg,
    nextReleaseState: ReleaseState.Released,
    nextReportVersion: nextVersion,
  };
}
