// SpecimenSection — renders fields driven entirely by specimenResolver.
// Free-text label is shown read-only; it never drives behaviour.

import { useActiveAccession } from "../../store/useAccessionStore";
import { resolveSpecimen } from "../../logic/specimenResolver";
import { getFamily } from "../../config/specimenFamilies";
import { SpecimenFieldsForm } from "./SpecimenFieldsForm";

const FIELD_LABELS: Record<string, string> = {
  setCount: "Set count",
  bottleType: "Bottle type",
  drawSite: "Draw site",
  drawTime: "Draw time",
  contaminationContext: "Contamination context",
  neonatalWeight: "Neonatal weight (g)",
  collectionMethodNote: "Collection method note",
  catheterInSituDays: "Catheter in-situ (days)",
  contaminationNotes: "Contamination notes",
  ventilatorStatus: "Ventilator status",
  specimenVolumeMl: "Specimen volume (mL)",
  anatomicSite: "Anatomic site",
  imageGuidance: "Image guidance",
  drainSiteDays: "Drain in-situ (days)",
  screenRound: "Screen round",
  priorPositive: "Prior positive",
};

function Pill({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "warn" | "alert" | "ok" }) {
  const cls =
    tone === "alert"
      ? "bg-destructive/15 text-destructive"
      : tone === "warn"
      ? "bg-secondary text-secondary-foreground"
      : tone === "ok"
      ? "bg-muted text-foreground"
      : "bg-muted text-muted-foreground";
  return <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
}

export function SpecimenSection() {
  const accession = useActiveAccession();
  if (!accession) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No active accession.
      </div>
    );
  }

  const { familyCode, subtypeCode, freeTextLabel, containerCode } = accession.specimen;
  const family = getFamily(familyCode);
  const result = resolveSpecimen(familyCode, subtypeCode);

  if (!result.ok) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">
          Unresolved specimen ({result.reason}). Family: <code>{familyCode}</code>, subtype: <code>{subtypeCode}</code>.
        </p>
      </div>
    );
  }

  const p = result.profile;
  const acceptanceTone = p.acceptance.mode === "rejectable" ? "alert" : p.acceptance.mode === "qualified" ? "warn" : "ok";

  return (
    <div className="space-y-5">
      {/* Coded identity */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Family</div>
          <div className="font-mono text-sm text-foreground">{family?.display ?? familyCode}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Subtype</div>
          <div className="font-mono text-sm text-foreground">{p.displayName}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Container</div>
          <div className="font-mono text-sm text-foreground">{containerCode ?? "—"}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Label (display)</div>
          <div className="text-sm text-foreground">{freeTextLabel ?? "—"}</div>
        </div>
      </div>

      {/* Resolved badges */}
      <div className="flex flex-wrap gap-1.5">
        <Pill tone={acceptanceTone}>acceptance: {p.acceptance.mode}</Pill>
        <Pill tone={p.gating.pathway === "screen" ? "warn" : "default"}>pathway: {p.gating.pathway}</Pill>
        {p.syndrome && <Pill>syndrome: {p.syndrome}</Pill>}
        {p.gating.consultantReleaseRequired && <Pill tone="alert">consultant release</Pill>}
        {p.gating.criticalCommunicationRequired && <Pill tone="warn">critical comms</Pill>}
        {p.acceptance.contaminationContextRequired && <Pill tone="warn">contamination context required</Pill>}
        {p.gating.clearanceTracked && <Pill tone="warn">clearance tracked</Pill>}
      </div>

      {p.acceptance.notes && (
        <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-foreground">{p.acceptance.notes}</p>
      )}

      {/* Editable collection fields (resolver-driven) */}
      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Collection details
        </h4>
        <SpecimenFieldsForm
          accession={accession}
          required={p.requiredFields}
          optional={p.optionalFields}
        />
      </section>

      {/* Workbench panels + report sections projection */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Workbench panels
          </h4>
          <ul className="flex flex-wrap gap-1.5">
            {p.workbenchPanels.map((w) => (
              <li key={w} className="rounded bg-secondary px-2 py-1 font-mono text-[11px] text-secondary-foreground">
                {w}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Report sections
          </h4>
          <ul className="flex flex-wrap gap-1.5">
            {p.reportSections.map((r) => (
              <li key={r} className="rounded bg-muted px-2 py-1 font-mono text-[11px] text-foreground">
                {r}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {p.quantitative && (
        <section className="rounded-md border border-border bg-background p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Quantitative interpretation hook
          </h4>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{p.quantitative.code}</code>
            {p.quantitative.thresholds?.significantCfuPerMl !== undefined && (
              <span className="text-foreground">
                significant ≥ {p.quantitative.thresholds.significantCfuPerMl.toExponential(0)} CFU/mL
              </span>
            )}
            {p.quantitative.thresholds?.contaminationCfuPerMl !== undefined && (
              <span className="text-muted-foreground">
                · contamination ≤ {p.quantitative.thresholds.contaminationCfuPerMl.toExponential(0)} CFU/mL
              </span>
            )}
          </div>
        </section>
      )}

      {p.ipcFlagHints.length > 0 && (
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            IPC flag hints
          </h4>
          <ul className="flex flex-wrap gap-1.5">
            {p.ipcFlagHints.map((h) => (
              <li key={h} className="rounded bg-destructive/10 px-2 py-1 font-mono text-[11px] text-destructive">
                {h}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
