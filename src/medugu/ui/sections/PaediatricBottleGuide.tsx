// PaediatricBottleGuide — bedside aid shown in Collection Details for
// blood culture workups when the patient is paediatric. Pure UI: it
// reads the patient weight (kg) entered locally on the form and the
// patient DOB from the accession, and surfaces the recommended bottle
// composition and per-bottle volume from the weight-band table.
//
// No clinical engine reads this; it is informational only.

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { meduguActions } from "../../store/useAccessionStore";
import type { Accession } from "../../domain/types";
import {
  PAED_BLOOD_VOLUME_BANDS,
  ageYearsFromDob,
  bandForWeight,
  isPaediatricAge,
} from "../../config/paediatricBloodVolume";

interface Props {
  accession: Accession;
}

export function PaediatricBottleGuide({ accession }: Props) {
  const details = accession.specimen.details ?? {};
  const persistedWeight =
    typeof details.patientWeightKg === "number" ? (details.patientWeightKg as number) : undefined;

  const ageY = ageYearsFromDob(accession.patient.dob);
  const paedByAge = isPaediatricAge(accession.patient.dob);
  const [forceShow, setForceShow] = useState<boolean>(false);
  const [weightDraft, setWeightDraft] = useState<string>(
    persistedWeight != null ? String(persistedWeight) : "",
  );

  const visible = paedByAge || forceShow || persistedWeight != null;

  const weightKg = useMemo(() => {
    const n = Number(weightDraft);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }, [weightDraft]);

  const band = useMemo(() => bandForWeight(weightKg), [weightKg]);

  function commitWeight(next: number | undefined) {
    const nextDetails = { ...details, patientWeightKg: next };
    if (next == null) delete (nextDetails as Record<string, unknown>).patientWeightKg;
    meduguActions.upsertAccession({
      ...accession,
      specimen: { ...accession.specimen, details: nextDetails },
    });
  }

  if (!visible) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-2 text-[11px] text-muted-foreground">
        <button
          type="button"
          onClick={() => setForceShow(true)}
          className="underline-offset-2 hover:underline"
        >
          Patient is a child? Show paediatric bottle &amp; volume guide
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Paediatric bottle &amp; volume guide
          </div>
          <p className="text-[11px] text-muted-foreground">
            Weight-banded recommendations. Cap total draw at ~1% of patient blood volume per 24 h.
            {ageY != null && (
              <>
                {" "}
                Age from DOB: <span className="font-medium text-foreground">{ageY.toFixed(1)} y</span>.
              </>
            )}
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="paed-weight" className="text-[11px]">
              Patient weight (kg)
            </Label>
            <Input
              id="paed-weight"
              type="number"
              inputMode="decimal"
              min={0}
              step={0.1}
              value={weightDraft}
              onChange={(e) => setWeightDraft(e.target.value)}
              onBlur={() => commitWeight(weightKg)}
              className="h-8 w-28 text-xs"
              placeholder="e.g. 12"
            />
          </div>
        </div>
      </div>

      {band ? (
        <div className="mb-2 rounded border border-primary/30 bg-primary/5 p-2 text-xs">
          <div className="font-medium text-foreground">
            {band.label} → {band.bottle}
          </div>
          <div className="text-muted-foreground">
            {band.perBottleMl} per bottle · total {band.totalMl} · {band.sets}
          </div>
          {band.note && <div className="mt-1 text-[11px] text-muted-foreground">{band.note}</div>}
        </div>
      ) : (
        <p className="mb-2 text-[11px] text-muted-foreground">
          Enter patient weight to see the recommended bottle and volume.
        </p>
      )}

      <div className="overflow-hidden rounded border border-border">
        <table className="w-full text-[11px]">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-2 py-1 text-left font-medium">Weight</th>
              <th className="px-2 py-1 text-left font-medium">Bottle(s)</th>
              <th className="px-2 py-1 text-left font-medium">Per bottle</th>
              <th className="px-2 py-1 text-left font-medium">Total</th>
              <th className="px-2 py-1 text-left font-medium">Sets</th>
            </tr>
          </thead>
          <tbody>
            {PAED_BLOOD_VOLUME_BANDS.map((b) => {
              const active = band && b.minKg === band.minKg;
              return (
                <tr
                  key={b.label}
                  className={
                    active ? "bg-primary/10 font-medium text-foreground" : "even:bg-muted/20"
                  }
                >
                  <td className="px-2 py-1 align-top">{b.label}</td>
                  <td className="px-2 py-1 align-top">{b.bottle}</td>
                  <td className="px-2 py-1 align-top">{b.perBottleMl}</td>
                  <td className="px-2 py-1 align-top">{b.totalMl}</td>
                  <td className="px-2 py-1 align-top">{b.sets}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
        Reference: institutional paediatric blood culture protocols (Vanderbilt, Univ. of Iowa,
        Alberta Health Services) aligned with CLSI M47. Display only — engines do not read this.
      </p>
    </div>
  );
}
