// Continuous case workspace: case list on the left, persistent context bar
// on top of a single scrollable surface that stacks every workflow section.
// No tab-only navigation — sections are collapsible but always reachable.

import { CaseManager } from "./CaseManager";
import { ContextBar } from "./ContextBar";
import { SectionRail } from "./SectionRail";
import { SectionPanel } from "./SectionPanel";
import {
  PatientSection,
  SpecimenSection,
  MicroscopySection,
  IsolateSection,
  ASTSection,
  StewardshipSection,
  IPCSection,
  ValidationSection,
  ReleaseSection,
  ReportSection,
  ExportSection,
  BenchmarkSection,
  SECTION_ORDER,
} from "./sections";
import { useActiveAccession, useMeduguState } from "../store/useAccessionStore";

const SECTION_COMPONENTS = {
  patient: PatientSection,
  specimen: SpecimenSection,
  microscopy: MicroscopySection,
  isolate: IsolateSection,
  ast: ASTSection,
  stewardship: StewardshipSection,
  ipc: IPCSection,
  validation: ValidationSection,
  release: ReleaseSection,
  report: ReportSection,
  export: ExportSection,
  benchmark: BenchmarkSection,
} as const;

export function AppShell() {
  const accession = useActiveAccession();
  const state = useMeduguState();

  return (
    <div className="grid h-screen grid-cols-[280px_1fr] bg-background text-foreground">
      <CaseManager />

      <main className="flex h-screen min-w-0 flex-col overflow-hidden">
        <header className="border-b border-border bg-card px-6 py-3">
          {accession ? (
            <div className="flex items-baseline justify-between gap-4">
              <div className="min-w-0">
                <h2 className="font-mono text-xs text-muted-foreground">
                  {accession.accessionNumber}
                </h2>
                <p className="truncate text-base font-semibold text-foreground">
                  {accession.patient.givenName} {accession.patient.familyName} ·{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    {accession.specimen.freeTextLabel ?? accession.specimen.subtypeCode}
                  </span>
                </p>
              </div>
              <div className="flex shrink-0 gap-2 text-[11px] uppercase">
                <span className="rounded bg-muted px-2 py-1 text-muted-foreground">
                  {accession.workflowStatus}
                </span>
                <span className="rounded bg-secondary px-2 py-1 text-secondary-foreground">
                  {accession.priority}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No active accession selected.</p>
          )}
        </header>

        {accession && <ContextBar accession={accession} />}

        <div className="flex flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto">
            {accession ? (
              <div className="space-y-4 p-6">
                {SECTION_ORDER.map((s) => {
                  const Cmp = SECTION_COMPONENTS[s.key];
                  return (
                    <SectionPanel
                      key={s.key}
                      id={`sec-${s.key}`}
                      title={s.label}
                      defaultOpen={
                        s.key === "patient" ||
                        s.key === "specimen" ||
                        s.key === "isolate" ||
                        s.key === "ast"
                      }
                    >
                      <Cmp />
                    </SectionPanel>
                  );
                })}
              </div>
            ) : (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Select a case from the left, or reset to demo seed.
              </div>
            )}
          </div>
          <SectionRail />
        </div>

        <footer className="border-t border-border bg-card px-4 py-1.5 text-[10px] text-muted-foreground">
          build {state.buildVersion} · rules {state.ruleVersion.version} · breakpoints{" "}
          {state.breakpointVersion} · export {state.exportVersion}
        </footer>
      </main>
    </div>
  );
}
