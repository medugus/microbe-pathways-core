// ExportSection — surfaces governed FHIR / HL7 / normalised-JSON exports.
// Client-side only; no network. Reads frozen ReleasePackage when present.

import { useMemo, useState } from "react";
import { useActiveAccession } from "../../store/useAccessionStore";
import {
  buildExport,
  evaluateExportGate,
  type ExportFormat,
} from "../../logic/exportEngine";
import { copyText, downloadText } from "../../utils/exportHelpers";

const FORMATS: { code: ExportFormat; label: string; hint: string }[] = [
  { code: "fhir", label: "FHIR R4 Bundle (JSON)", hint: "DiagnosticReport + Patient + Specimen + Observations" },
  { code: "hl7", label: "HL7 v2.5 ORU^R01", hint: "MSH / PID / PV1 / OBR / OBX / NTE" },
  { code: "json", label: "Normalised JSON", hint: "Stable schema for downstream pipelines" },
];

export function ExportSection() {
  const accession = useActiveAccession();
  const [active, setActive] = useState<ExportFormat>("fhir");
  const [copied, setCopied] = useState<string | null>(null);

  const gate = useMemo(() => (accession ? evaluateExportGate(accession) : null), [accession]);
  const payload = useMemo(
    () => (accession && gate?.available ? buildExport(accession, active) : null),
    [accession, active, gate?.available],
  );

  if (!accession) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No active accession.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-border bg-background p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Export status</div>
            <div className={`text-sm font-medium ${gate?.available ? "text-foreground" : "text-destructive"}`}>
              {gate?.available ? "Export available" : "Export blocked"}
            </div>
            {!gate?.available && gate?.reason && (
              <p className="mt-1 text-[11px] text-destructive">{gate.reason}</p>
            )}
            {gate?.available && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Source:{" "}
                <span className="font-mono">
                  {gate.fromReleasePackage ? "frozen ReleasePackage" : "validated live preview"}
                </span>
              </p>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground">
            <div>rules: <span className="font-mono">{gate?.versions.rule}</span></div>
            <div>breakpoints: <span className="font-mono">{gate?.versions.breakpoint}</span></div>
            <div>export: <span className="font-mono">{gate?.versions.export}</span></div>
            <div>build: <span className="font-mono">{gate?.versions.build}</span></div>
          </div>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap gap-2">
          {FORMATS.map((f) => (
            <button
              key={f.code}
              type="button"
              onClick={() => setActive(f.code)}
              className={`rounded border px-3 py-1.5 text-xs ${
                active === f.code
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {FORMATS.find((f) => f.code === active)?.hint}
        </p>
      </section>

      {payload ? (
        <section className="rounded-md border border-border bg-card">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
            <div className="text-xs">
              <span className="font-mono text-muted-foreground">{payload.filename}</span>
              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {payload.mime}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  const ok = await copyText(payload.content);
                  setCopied(ok ? payload.format : null);
                  setTimeout(() => setCopied(null), 1500);
                }}
                className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
              >
                {copied === payload.format ? "Copied ✓" : "Copy"}
              </button>
              <button
                type="button"
                onClick={() => downloadText(payload.filename, payload.mime, payload.content)}
                className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:opacity-90"
              >
                Download
              </button>
            </div>
          </header>
          <pre className="max-h-96 overflow-auto bg-muted p-3 font-mono text-[11px] leading-relaxed text-foreground">
            {payload.content}
          </pre>
        </section>
      ) : (
        <p className="rounded-md border border-dashed border-border bg-card p-4 text-xs text-muted-foreground">
          Export payload will appear here once the report is released (or has zero validation blockers).
        </p>
      )}

      <p className="text-[10px] text-muted-foreground">
        All payloads are produced client-side. No data is transmitted to any server at the time of export.
      </p>
    </div>
  );
}
