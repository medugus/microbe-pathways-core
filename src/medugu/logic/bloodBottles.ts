// Single source of truth for blood-culture bottle results.
//
// As of the 2026-05-01 refactor, bottle facts (lifecycle status, Gram stain,
// critical call, TTP, termination) live at the SPECIMEN level rather than
// per-isolate, because they describe the bottle/instrument event — not the
// organism. Bottle ↔ isolate linkage continues to live on
// `Isolate.bloodSourceLinks`.
//
// Storage location:
//   accession.specimen.details.bottleResults: BloodBottleResult[]
//
// Backward compatibility:
//   Older accessions stored bottle rows on each isolate. `getBottleResults()`
//   transparently merges any legacy `Isolate.bottleResults` into the result
//   so engines (validation, export, worklist, dashboard) keep working without
//   a data migration. New writes always go to the specimen.

import type {
  Accession,
  BloodBottleResult,
  BottleLifecycleStatus,
} from "../domain/types";

/** Stable key for a (setNo, bottleType) pair. */
export function bottleKey(setNo: number, bottleType: string): string {
  return `${setNo}|${bottleType}`;
}

/**
 * Read the canonical bottle-result list for an accession. Specimen-level
 * rows take precedence; legacy per-isolate rows are unioned in for backward
 * compatibility (deduped by setNo+bottleType).
 */
export function getBottleResults(accession: Accession): BloodBottleResult[] {
  const seen = new Map<string, BloodBottleResult>();

  // Legacy per-isolate rows first (so specimen-level overrides them).
  for (const iso of accession.isolates) {
    for (const r of iso.bottleResults ?? []) {
      seen.set(bottleKey(r.setNo, r.bottleType), r);
    }
  }

  const details = (accession.specimen.details ?? {}) as Record<string, unknown>;
  const specimenRows = Array.isArray(details.bottleResults)
    ? (details.bottleResults as BloodBottleResult[])
    : [];
  for (const r of specimenRows) {
    seen.set(bottleKey(r.setNo, r.bottleType), r);
  }

  return Array.from(seen.values()).sort(
    (a, b) => a.setNo - b.setNo || a.bottleType.localeCompare(b.bottleType),
  );
}

/**
 * Build the next accession with `bottleResults` written to specimen.details.
 * Caller persists via `meduguActions.upsertAccession`.
 *
 * Also clears any legacy per-isolate `bottleResults` so we don't keep two
 * sources of truth alive (the union helper would otherwise re-introduce
 * stale rows after edits).
 */
export function withBottleResults(
  accession: Accession,
  next: BloodBottleResult[],
): Accession {
  const sorted = [...next].sort(
    (a, b) => a.setNo - b.setNo || a.bottleType.localeCompare(b.bottleType),
  );
  const nextDetails: Record<string, unknown> = {
    ...(accession.specimen.details ?? {}),
    bottleResults: sorted,
  };
  return {
    ...accession,
    specimen: { ...accession.specimen, details: nextDetails },
    isolates: accession.isolates.map((iso) =>
      iso.bottleResults && iso.bottleResults.length > 0
        ? { ...iso, bottleResults: undefined }
        : iso,
    ),
  };
}

/** Upsert a single bottle row by (setNo, bottleType). */
export function upsertBottleResult(
  accession: Accession,
  row: BloodBottleResult,
): Accession {
  const all = getBottleResults(accession).filter(
    (r) => !(r.setNo === row.setNo && r.bottleType === row.bottleType),
  );
  all.push(row);
  return withBottleResults(accession, all);
}

/** True when a bottle status (or legacy growth) implies an instrument-positive flag. */
export function isPositiveBottle(b: BloodBottleResult): boolean {
  if (b.status === "flagged_positive" || b.status === "removed") return true;
  return b.growth === "growth";
}

/** Default ISO timestamps to auto-stamp on a status transition (Beaker convention). */
export function timestampPatchForStatus(
  status: BottleLifecycleStatus,
  current: BloodBottleResult,
  nowIso: string = new Date().toISOString(),
): Partial<BloodBottleResult> {
  const patch: Partial<BloodBottleResult> = {};
  switch (status) {
    case "received":
      if (!current.receivedAt) patch.receivedAt = nowIso;
      break;
    case "loaded":
    case "incubating":
      if (!current.receivedAt) patch.receivedAt = nowIso;
      if (!current.loadedAt) patch.loadedAt = nowIso;
      break;
    case "flagged_positive":
      if (!current.receivedAt) patch.receivedAt = nowIso;
      if (!current.loadedAt) patch.loadedAt = nowIso;
      if (!current.positiveAt) patch.positiveAt = nowIso;
      break;
    case "removed":
      if (!current.receivedAt) patch.receivedAt = nowIso;
      if (!current.loadedAt) patch.loadedAt = nowIso;
      if (!current.positiveAt) patch.positiveAt = nowIso;
      if (!current.unloadedAt) patch.unloadedAt = nowIso;
      break;
    case "terminal_negative":
    case "discontinued":
      if (!current.terminatedAt) patch.terminatedAt = nowIso;
      break;
  }
  return patch;
}
