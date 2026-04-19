// Persistent context strip across the top of the workspace.
// Surfaces patient + specimen + isolate + stewardship + IPC + release state
// so the operator never loses case context while moving between sections.

import type { Accession } from "../domain/types";

interface Props {
  accession: Accession;
}

function Cell({ label, value, tone = "default" }: {
  label: string;
  value: string;
  tone?: "default" | "warn" | "alert" | "ok";
}) {
  const toneClass =
    tone === "warn"
      ? "text-foreground"
      : tone === "alert"
      ? "text-destructive"
      : tone === "ok"
      ? "text-foreground"
      : "text-foreground";
  return (
    <div className="min-w-0 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`truncate text-sm font-medium ${toneClass}`}>{value}</div>
    </div>
  );
}

export function ContextBar({ accession }: Props) {
  const isolateSummary =
    accession.isolates.length === 0
      ? "No isolates"
      : accession.isolates
          .map((i) => `#${i.isolateNo} ${i.organismDisplay}`)
          .join(" · ");

  const stewardshipSummary =
    accession.stewardship.length === 0
      ? "Clear"
      : `${accession.stewardship.length} flag(s)`;

  const ipcSummary =
    accession.ipc.length === 0
      ? "Clear"
      : accession.ipc.map((s) => s.flag).join(", ");

  return (
    <div className="grid grid-cols-2 gap-x-2 border-b border-border bg-card md:grid-cols-3 lg:grid-cols-6">
      <Cell
        label="Patient"
        value={`${accession.patient.givenName} ${accession.patient.familyName} · ${accession.patient.sex}`}
      />
      <Cell
        label="Specimen"
        value={`${accession.specimen.familyCode} / ${accession.specimen.subtypeCode}`}
      />
      <Cell label="Isolates" value={isolateSummary} />
      <Cell
        label="Stewardship"
        value={stewardshipSummary}
        tone={accession.stewardship.length > 0 ? "warn" : "ok"}
      />
      <Cell
        label="IPC"
        value={ipcSummary}
        tone={accession.ipc.length > 0 ? "alert" : "ok"}
      />
      <Cell
        label="Release"
        value={`${accession.release.state} · v${accession.release.reportVersion}`}
      />
    </div>
  );
}
