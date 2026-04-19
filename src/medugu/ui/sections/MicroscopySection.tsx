// MicroscopySection — driven by the resolver's MicroscopyConfig.
// Shows required vs optional microscopy fields per coded specimen, and
// surfaces gating (e.g. Bartlett gates culture for sputum).

import { useActiveAccession } from "../../store/useAccessionStore";
import { resolveSpecimen } from "../../logic/specimenResolver";

const MICRO_LABELS: Record<string, string> = {
  gram: "Gram stain",
  cellCountWBC: "WBC count",
  cellCountRBC: "RBC count",
  differential: "Differential",
  afbStain: "AFB stain",
  indiaInk: "India ink",
  wetMount: "Wet mount",
  qualityScore_Bartlett: "Bartlett quality score",
  epithelialCells: "Squamous epithelial cells",
  leukocytes: "Leukocytes",
};

export function MicroscopySection() {
  const accession = useActiveAccession();
  if (!accession) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No active accession.
      </div>
    );
  }

  const result = resolveSpecimen(accession.specimen.familyCode, accession.specimen.subtypeCode);
  if (!result.ok) {
    return (
      <p className="text-sm text-destructive">
        Cannot configure microscopy — specimen unresolved ({result.reason}).
      </p>
    );
  }

  const m = result.profile.microscopy;
  const recorded = accession.microscopy.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded bg-muted px-2 py-1 text-muted-foreground">
          {recorded} finding(s) recorded
        </span>
        {m.structured && (
          <span className="rounded bg-secondary px-2 py-1 text-secondary-foreground">
            structured entry
          </span>
        )}
        {m.gatesCulture && (
          <span className="rounded bg-destructive/15 px-2 py-1 text-destructive">
            quality gates culture
          </span>
        )}
      </div>

      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Required microscopy
        </h4>
        {m.required.length === 0 ? (
          <p className="text-xs text-muted-foreground">No required microscopy for this specimen.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {m.required.map((k) => (
              <li
                key={k}
                className="flex items-center justify-between rounded border border-border bg-background px-3 py-2 text-sm"
              >
                <span className="text-foreground">{MICRO_LABELS[k] ?? k}</span>
                <code className="text-[10px] text-muted-foreground">{k}</code>
              </li>
            ))}
          </ul>
        )}
      </section>

      {m.optional.length > 0 && (
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Optional microscopy
          </h4>
          <ul className="flex flex-wrap gap-1.5">
            {m.optional.map((k) => (
              <li key={k} className="rounded bg-muted px-2 py-1 text-xs text-foreground">
                {MICRO_LABELS[k] ?? k}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
