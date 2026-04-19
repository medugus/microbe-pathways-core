import { useState, type ComponentType } from "react";
import { CaseManager } from "./CaseManager";
import { SectionTabs } from "./SectionTabs";
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
  type SectionKey,
} from "./sections";
import { useActiveAccession } from "../store/useAccessionStore";

const SECTION_COMPONENTS: Record<SectionKey, ComponentType> = {
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
};

export function AppShell() {
  const [section, setSection] = useState<SectionKey>("patient");
  const accession = useActiveAccession();
  const Section = SECTION_COMPONENTS[section];

  return (
    <div className="grid h-screen grid-cols-[280px_1fr] bg-background text-foreground">
      <CaseManager />
      <main className="flex h-screen flex-col overflow-hidden">
        <header className="border-b border-border bg-card px-6 py-3">
          {accession ? (
            <div className="flex items-baseline justify-between">
              <div>
                <h2 className="font-mono text-sm text-muted-foreground">{accession.id}</h2>
                <p className="text-base font-semibold text-foreground">
                  {accession.patient.givenName} {accession.patient.familyName} ·{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    {accession.specimen.freeTextLabel ?? accession.specimen.subtypeCode}
                  </span>
                </p>
              </div>
              <div className="flex gap-2 text-[11px] uppercase">
                <span className="rounded bg-muted px-2 py-1 text-muted-foreground">
                  {accession.stage}
                </span>
                <span className="rounded bg-secondary px-2 py-1 text-secondary-foreground">
                  {accession.release.state}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No active accession selected.</p>
          )}
        </header>

        <SectionTabs active={section} onChange={setSection} />

        <div className="flex-1 overflow-y-auto p-6">
          <Section />
        </div>
      </main>
    </div>
  );
}
