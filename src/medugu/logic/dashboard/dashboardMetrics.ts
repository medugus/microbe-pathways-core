import type { Accession } from "../../domain/types";
import type { OperationalQueueItem } from "./dashboardTypes";

export function toPatientLabel(accession: Accession): string {
  const name = [accession.patient.givenName, accession.patient.familyName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name || accession.patient.mrn || accession.accessionNumber;
}

export function toSpecimenLabel(accession: Accession): string {
  return accession.specimen.freeTextLabel ?? accession.specimen.subtypeCode;
}

export function toAgeHours(accession: Accession): number | undefined {
  const base =
    accession.specimen.collectedAt ?? accession.specimen.receivedAt ?? accession.createdAt;
  const ms = Date.parse(base);
  if (!Number.isFinite(ms)) return undefined;
  return Math.max(0, Math.round((Date.now() - ms) / 3_600_000));
}

export function normaliseAccessions(
  accessions: Record<string, Accession> | Accession[],
): Accession[] {
  return Array.isArray(accessions) ? accessions : Object.values(accessions);
}

export function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[middle - 1] + sorted[middle]) / 2) * 10) / 10;
  }
  return sorted[middle];
}

export function uniqueAccessionCount(
  items: OperationalQueueItem[],
  predicate: (item: OperationalQueueItem) => boolean,
): number {
  return new Set(items.filter(predicate).map((item) => item.accessionId)).size;
}
