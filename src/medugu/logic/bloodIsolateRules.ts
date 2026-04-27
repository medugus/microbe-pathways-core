// Blood-culture isolate rules — pure helpers, no React.
//
// Encodes the policy for blood culture isolate allocation:
//  - 1 isolate is the easy/common case
//  - 2 isolates allowed
//  - 3 isolates allowed but unusual (contamination-prone)
//  - >3 not allowed
//
// Provides classification helpers used by IsolateSection, ValidationEngine,
// reportPreview, and exportEngine. All rules live here so the UI stays thin
// and downstream engines do not duplicate business logic.

import type { Accession, BloodSourceLink, Isolate } from "../domain/types";

export const BC_MAX_ISOLATES = 3;
export const BC_SOFT_LIMIT = 2;

/** True when the accession is a blood culture (specimen.familyCode === "BLOOD"). */
export function isBloodCulture(accession: Accession): boolean {
  return accession.specimen.familyCode === "BLOOD";
}

/** True when adding another isolate is permitted (cap at 3). */
export function canAddBloodIsolate(accession: Accession): boolean {
  if (!isBloodCulture(accession)) return true;
  return countRealIsolates(accession) < BC_MAX_ISOLATES;
}

/** Real isolates exclude the synthetic "no growth" placeholder. */
export function countRealIsolates(accession: Accession): number {
  return accession.isolates.filter((i) => i.organismCode !== "NOGRO").length;
}

/** True once we hit the unusual/contamination-prone tier (3 isolates). */
export function isAtUnusualIsolateCount(accession: Accession): boolean {
  return isBloodCulture(accession) && countRealIsolates(accession) >= BC_MAX_ISOLATES;
}

/**
 * True when every real BC isolate is marked as a true pathogen ("significant").
 * Used to surface a senior-review warning when 3-of-3 are called pathogens.
 */
export function allBloodIsolatesPathogen(accession: Accession): boolean {
  if (!isBloodCulture(accession)) return false;
  const real = accession.isolates.filter((i) => i.organismCode !== "NOGRO");
  if (real.length === 0) return false;
  return real.every((i) => i.significance === "significant");
}

/** True if any BC isolate is flagged as a probable contaminant. */
export function hasContaminantIsolate(accession: Accession): boolean {
  if (!isBloodCulture(accession)) return false;
  return accession.isolates.some(
    (i) => i.organismCode !== "NOGRO" && i.significance === "probable_contaminant",
  );
}

/** Positive (setNo, bottleType) pairs across all isolates' bottleResults. */
export function listPositiveBottles(accession: Accession): BloodSourceLink[] {
  const seen = new Map<string, BloodSourceLink>();
  for (const iso of accession.isolates) {
    for (const r of iso.bottleResults ?? []) {
      if (r.growth === "growth") {
        const key = `${r.setNo}|${r.bottleType}`;
        if (!seen.has(key)) seen.set(key, { setNo: r.setNo, bottleType: r.bottleType });
      }
    }
  }
  return [...seen.values()].sort(
    (a, b) => a.setNo - b.setNo || a.bottleType.localeCompare(b.bottleType),
  );
}

/** True when the accession has any positive bottle recorded on any isolate. */
export function hasAnyPositiveBottle(accession: Accession): boolean {
  return accession.isolates.some((i) => (i.bottleResults ?? []).some((r) => r.growth === "growth"));
}

export interface BloodIsolateValidationIssue {
  code: string;
  severity: "block" | "warn";
  message: string;
}

/**
 * Validate blood-culture isolate allocation. Returns a flat list the
 * validation engine maps into ValidationIssue instances.
 *
 * Rules surfaced here (not duplicated in the UI):
 *  1. > BC_MAX_ISOLATES isolates → blocker (defensive; UI also caps adds)
 *  2. positive bottles recorded but zero real isolates → blocker
 *  3. each real isolate must carry significance != "indeterminate" → blocker
 *  4. each real isolate must link to ≥1 (set, bottle) source → blocker
 *  5. all 3 isolates marked "significant" → senior-review warning
 *  6. any "probable_contaminant" → informational warning (carried into report)
 */
export function validateBloodIsolates(accession: Accession): BloodIsolateValidationIssue[] {
  if (!isBloodCulture(accession)) return [];
  const out: BloodIsolateValidationIssue[] = [];
  const real = accession.isolates.filter((i) => i.organismCode !== "NOGRO");

  if (real.length > BC_MAX_ISOLATES) {
    out.push({
      code: "BC_ISO_OVER_LIMIT",
      severity: "block",
      message: `Blood culture supports at most ${BC_MAX_ISOLATES} isolates (have ${real.length}).`,
    });
  }

  if (real.length === 0 && hasAnyPositiveBottle(accession)) {
    out.push({
      code: "BC_ISO_MISSING_FOR_POSITIVE",
      severity: "block",
      message: "Positive blood culture bottles recorded but no isolate has been added.",
    });
  }

  real.forEach((iso) => {
    if (!iso.significance || iso.significance === "indeterminate") {
      out.push({
        code: `BC_ISO_${iso.isolateNo}_SIGNIFICANCE_MISSING`,
        severity: "block",
        message: `Isolate ${iso.isolateNo} (${iso.organismDisplay}): clinical significance must be classified before release.`,
      });
    }
    const links = iso.bloodSourceLinks ?? [];
    if (links.length === 0) {
      out.push({
        code: `BC_ISO_${iso.isolateNo}_SOURCE_MISSING`,
        severity: "block",
        message: `Isolate ${iso.isolateNo} (${iso.organismDisplay}): link to at least one positive set/bottle before release.`,
      });
    }
  });

  if (real.length === BC_MAX_ISOLATES && allBloodIsolatesPathogen(accession)) {
    out.push({
      code: "BC_ISO_TRIPLE_PATHOGEN_REVIEW",
      severity: "warn",
      message:
        "Three blood-culture isolates all marked as true pathogens — senior/consultant review recommended before release.",
    });
  }

  if (hasContaminantIsolate(accession)) {
    out.push({
      code: "BC_ISO_CONTAMINANT_PRESENT",
      severity: "warn",
      message:
        "One or more blood-culture isolates marked as probable contaminant — carried through to report comments.",
    });
  }

  return out;
}

/** Stable key for a (setNo, bottleType) pair, used in toggles/maps. */
export function sourceLinkKey(setNo: number, bottleType: string): string {
  return `${setNo}|${bottleType}`;
}

/** Toggle a (set, bottle) link in an isolate's existing source list. */
export function toggleSourceLink(
  existing: BloodSourceLink[] | undefined,
  setNo: number,
  bottleType: string,
): BloodSourceLink[] {
  const list = existing ?? [];
  const key = sourceLinkKey(setNo, bottleType);
  const has = list.some((l) => sourceLinkKey(l.setNo, l.bottleType) === key);
  if (has) return list.filter((l) => sourceLinkKey(l.setNo, l.bottleType) !== key);
  return [...list, { setNo, bottleType }].sort(
    (a, b) => a.setNo - b.setNo || a.bottleType.localeCompare(b.bottleType),
  );
}

/** Per-isolate display tag derived from significance. */
export function significanceTag(iso: Isolate): {
  label: string;
  tone: "danger" | "warn" | "info" | "muted";
} {
  switch (iso.significance) {
    case "significant":
      return { label: "true pathogen", tone: "danger" };
    case "probable_contaminant":
      return { label: "probable contaminant", tone: "warn" };
    case "mixed_growth":
      return { label: "mixed growth", tone: "warn" };
    case "normal_flora":
      return { label: "normal flora", tone: "muted" };
    default:
      return { label: "uncertain significance", tone: "info" };
  }
}
