// Paediatric blood culture volume guide — weight-banded.
//
// Reference table aligned with widely-used institutional protocols
// (e.g. Vanderbilt, University of Iowa, Alberta Health Services) and
// CLSI M47 principles: the volume of blood cultured is the single most
// important variable for sensitivity, but in children it must be
// balanced against total blood volume (~70–80 mL/kg) so that no more
// than ~1% of the patient's blood volume is drawn per 24 h.
//
// Display only. No clinical engine reads this directly — it is a
// bedside aid for the collector when working up a paediatric patient.

export interface PaedBloodBand {
  /** Inclusive lower bound, kg. */
  minKg: number;
  /** Exclusive upper bound, kg. Use Infinity for the top band. */
  maxKg: number;
  label: string;
  /** Recommended bottle composition for this band (1 set unless stated). */
  bottle: string;
  /** Recommended draw volume per bottle, mL. */
  perBottleMl: string;
  /** Total volume per draw / culture episode, mL. */
  totalMl: string;
  /** Number of culture sets recommended (per episode). */
  sets: string;
  /** Free-text caveat shown beneath the row. */
  note?: string;
}

export const PAED_BLOOD_VOLUME_BANDS: PaedBloodBand[] = [
  {
    minKg: 0,
    maxKg: 1.5,
    label: "Neonate <1.5 kg",
    bottle: "Paediatric × 1",
    perBottleMl: "0.5–1 mL",
    totalMl: "≤1 mL",
    sets: "1 set",
    note: "Cap at ~1% of total blood volume. Document weight on accession.",
  },
  {
    minKg: 1.5,
    maxKg: 5,
    label: "Neonate 1.5–5 kg",
    bottle: "Paediatric × 1",
    perBottleMl: "1–2 mL",
    totalMl: "1–2 mL",
    sets: "1 set",
    note: "Single paediatric bottle; anaerobic only if clinically indicated.",
  },
  {
    minKg: 5,
    maxKg: 14,
    label: "Infant 5–13 kg",
    bottle: "Paediatric × 2 (or Paed + Anaerobic if indicated)",
    perBottleMl: "4 mL",
    totalMl: "4–8 mL",
    sets: "1–2 sets",
    note: "Add anaerobic bottle for chronic GI, intra-abdominal, or oncology source.",
  },
  {
    minKg: 14,
    maxKg: 26,
    label: "Child 14–25 kg",
    bottle: "Adult Aerobic + Anaerobic",
    perBottleMl: "5 mL",
    totalMl: "10 mL",
    sets: "2 sets (different sites)",
  },
  {
    minKg: 26,
    maxKg: 40,
    label: "Child 26–39 kg",
    bottle: "Adult Aerobic + Anaerobic",
    perBottleMl: "8 mL",
    totalMl: "16 mL",
    sets: "2 sets (different sites)",
  },
  {
    minKg: 40,
    maxKg: Infinity,
    label: "Adolescent ≥40 kg",
    bottle: "Adult Aerobic + Anaerobic",
    perBottleMl: "10 mL",
    totalMl: "20 mL",
    sets: "2 sets (different sites)",
    note: "Treat as adult workup.",
  },
];

export function bandForWeight(weightKg: number | undefined): PaedBloodBand | undefined {
  if (weightKg == null || !Number.isFinite(weightKg) || weightKg <= 0) return undefined;
  return PAED_BLOOD_VOLUME_BANDS.find((b) => weightKg >= b.minKg && weightKg < b.maxKg);
}

/** Years between dob and now. Returns undefined if dob missing/invalid. */
export function ageYearsFromDob(dob: string | undefined, now: Date = new Date()): number | undefined {
  if (!dob) return undefined;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return undefined;
  const ms = now.getTime() - d.getTime();
  return ms / (365.25 * 24 * 60 * 60 * 1000);
}

/** True if age is known and < 18 years. */
export function isPaediatricAge(dob: string | undefined): boolean {
  const age = ageYearsFromDob(dob);
  return age != null && age < 18;
}
