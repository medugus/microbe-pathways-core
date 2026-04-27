// Read-only episode detail drawer. Consumes an IPCEpisodeDetail view-model
// produced by src/medugu/logic/ipcEpisodeDetail.ts. The drawer renders fields
// only and exposes a single "Open accession" navigation action — no IPC
// workflow controls, no engine calls.

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { IPCEpisodeDetail } from "../../logic/ipcEpisodeDetail";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: IPCEpisodeDetail | null;
  /** Callback invoked when the user clicks "Open accession". When omitted the
   *  button is hidden (e.g. when the drawer is opened from inside the linked
   *  accession's own workspace). */
  onOpenAccession?: () => void;
}

const TIMING_TONE: Record<string, string> = {
  immediate: "bg-destructive/20 text-destructive",
  same_shift: "bg-destructive/10 text-destructive",
  within_24h: "bg-muted text-foreground",
  next_business_day: "bg-muted text-muted-foreground",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 py-1 text-xs">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  );
}

export function IPCEpisodeDrawer({ open, onOpenChange, detail, onOpenAccession }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        {!detail ? (
          <p className="text-sm text-muted-foreground">No episode selected.</p>
        ) : (
          <>
            <SheetHeader className="space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {detail.ruleCode}
                </code>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] ${
                    TIMING_TONE[detail.timing] ?? "bg-muted"
                  }`}
                >
                  {detail.timing.replaceAll("_", " ")}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                    detail.episodeStatus === "new"
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {detail.episodeStatus} episode
                </span>
              </div>
              <SheetTitle className="text-base">IPC episode detail</SheetTitle>
              <SheetDescription className="text-xs">
                Read-only view. Workflow actions remain on the IPC dashboard.
              </SheetDescription>
            </SheetHeader>

            <p className="mt-3 rounded-md border border-border bg-card p-2 text-sm text-foreground">
              {detail.message}
            </p>

            <dl className="mt-3 divide-y divide-border">
              <Field label="Accession">
                {detail.accessionDisplayId ?? detail.accessionRowId ?? "—"}
              </Field>
              <Field label="Patient">{detail.patientLabel}</Field>
              <Field label="MRN">{detail.mrn ?? "—"}</Field>
              <Field label="Ward">{detail.ward ?? "—"}</Field>
              <Field label="Specimen">
                {detail.specimenFamily
                  ? `${detail.specimenFamily}${detail.specimenSubtype ? ` / ${detail.specimenSubtype}` : ""}`
                  : "—"}
              </Field>
              <Field label="Organism">
                {detail.organismDisplay
                  ? `${detail.organismDisplay} (${detail.organismCode ?? ""})`
                  : (detail.organismCode ?? "—")}
              </Field>
              <Field label="Phenotypes">
                {detail.phenotypes.length === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {detail.phenotypes.map((p) => (
                      <span
                        key={p as string}
                        className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-foreground"
                      >
                        {p as string}
                      </span>
                    ))}
                  </div>
                )}
              </Field>
              <Field label="Expert rules">
                {detail.expertRules.length === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {detail.expertRules.map((r) => (
                      <code
                        key={r}
                        className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {r}
                      </code>
                    ))}
                  </div>
                )}
              </Field>
              <Field label="Isolation">
                <div className="flex flex-wrap gap-1">
                  {(detail.actions as string[]).map((a) => (
                    <span
                      key={a}
                      className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary"
                    >
                      {a.replaceAll("_", " ")}
                    </span>
                  ))}
                </div>
              </Field>
              <Field label="Notify">
                {detail.notify.length > 0 ? detail.notify.join(", ") : "—"}
              </Field>
              <Field label="Escalation">{detail.timing.replaceAll("_", " ")}</Field>
              {detail.clearanceProgress && (
                <Field label="Clearance">
                  {detail.clearanceProgress.negativeCount}/{detail.clearanceProgress.required}{" "}
                  negative screens
                </Field>
              )}
              {detail.raisedAt && (
                <Field label="Raised at">{new Date(detail.raisedAt).toLocaleString()}</Field>
              )}
              {detail.windowBasis && (
                <Field label="Window">
                  <span className="text-[11px] text-muted-foreground">{detail.windowBasis}</span>
                </Field>
              )}
              {(detail.priorCases.length > 0 || detail.priorAccessionIds.length > 0) && (
                <Field label="Prior cases">
                  <ul className="space-y-1">
                    {(detail.priorCases.length > 0
                      ? detail.priorCases
                      : detail.priorAccessionIds.map((id) => ({
                          id,
                          accessionDisplayId: undefined as string | undefined,
                          patientLabel: undefined as string | undefined,
                          ward: undefined as string | undefined,
                        }))
                    ).map((p) => (
                      <li
                        key={p.id}
                        className="flex flex-wrap items-center gap-1.5 rounded border border-border bg-muted/30 px-1.5 py-1"
                      >
                        <code className="text-[10px] text-foreground">
                          {p.accessionDisplayId ?? p.id}
                        </code>
                        {p.patientLabel && (
                          <span className="text-[10px] text-muted-foreground">
                            · {p.patientLabel}
                          </span>
                        )}
                        {p.ward && (
                          <span className="rounded bg-background px-1 py-0.5 text-[10px] text-muted-foreground">
                            {p.ward}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Repeat episode — these prior accessions for this MRN already carried the same
                    rule + organism within the rolling window (local cohort only).
                  </p>
                </Field>
              )}
            </dl>

            {onOpenAccession ? (
              <div className="mt-4 flex justify-end">
                <Button size="sm" onClick={onOpenAccession}>
                  Open accession →
                </Button>
              </div>
            ) : (
              <p className="mt-4 text-[10px] text-muted-foreground">
                Already viewing the linked accession.
              </p>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
