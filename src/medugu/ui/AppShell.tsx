// Continuous case workspace: case list on the left, persistent context bar
// on top of a single scrollable surface that stacks every workflow section.
// No tab-only navigation — sections are collapsible but always reachable.

import { CaseManager } from "./CaseManager";
import { CommandPalette } from "./CommandPalette";
import { ContextBar } from "./ContextBar";
import { SectionRail } from "./SectionRail";
import { SectionPanel } from "./SectionPanel";
import { SoundTriggerGate } from "./SoundTriggerGate";
import { SoundAckChip } from "./SoundAckChip";
import { Link } from "@tanstack/react-router";
import {
  OperationalDashboardSection,
  PatientSection,
  SpecimenSection,
  MicroscopySection,
  IsolateSection,
  ASTSection,
  StewardshipSection,
  AMSSection,
  IPCSection,
  ValidationSection,
  ReleaseSection,
  ReportSection,
  ExportSection,
  BenchmarkSection,
  SECTION_ORDER,
} from "./sections";
import { useActiveAccession, useMeduguState } from "../store/useAccessionStore";
import { useConfigState } from "../store/configStore";

const SECTION_COMPONENTS = {
  operations: OperationalDashboardSection,
  patient: PatientSection,
  specimen: SpecimenSection,
  microscopy: MicroscopySection,
  isolate: IsolateSection,
  ast: ASTSection,
  stewardship: StewardshipSection,
  ams: AMSSection,
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
  const config = useConfigState();

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[minmax(220px,22vw)_1fr] bg-background text-foreground">
      <SoundTriggerGate />
      <CommandPalette />
      <CaseManager />

      <main className="flex min-h-screen min-w-0 flex-col overflow-hidden">
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
              <div className="flex shrink-0 items-center gap-2 text-[11px] uppercase">
                <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] normal-case text-muted-foreground md:inline">⌘K</kbd>
                <SoundAckChip />
                <Link
                  to="/settings/sounds"
                  className="text-[11px] normal-case text-muted-foreground hover:text-foreground"
                  title="Sound preferences"
                >
                  🔊
                </Link>
                <span className="rounded bg-muted px-2 py-1 text-muted-foreground">
                  {accession.workflowStatus}
                </span>
                <span className="rounded bg-secondary px-2 py-1 text-secondary-foreground">
                  {accession.priority}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">No active accession selected.</p>
              <div className="flex items-center gap-2">
                <SoundAckChip />
                <Link
                  to="/settings/sounds"
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                  title="Sound preferences"
                >
                  🔊
                </Link>
              </div>
            </div>
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
                        s.key === "operations" ||
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
          {state.breakpointVersion} · export {state.exportVersion} ·{" "}
          <span className="text-foreground/80">config v{config.active.meta.version}</span>
        </footer>
      </main>
    </div>
  );
}
