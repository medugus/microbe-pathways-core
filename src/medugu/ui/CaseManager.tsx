import { useState } from "react";
import { meduguActions, useMeduguState } from "../store/useAccessionStore";
import { NewAccessionDialog } from "./NewAccessionDialog";
import {
  REPRESENTATIVE_CASE_LIMIT,
  selectRepresentativeAccessions,
} from "../logic/representativeAccessions";

export function CaseManager() {
  const state = useMeduguState();
  const list = selectRepresentativeAccessions(state);
  const totalCount = Object.keys(state.accessions).length;
  const isCurated = totalCount > list.length;
  const [intakeOpen, setIntakeOpen] = useState(false);

  return (
    <aside className="flex h-full flex-col border-r border-border bg-sidebar">
      <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-3">
        <div>
          <h1 className="text-sm font-semibold text-sidebar-foreground">Medugu v3</h1>
          <p className="text-[11px] text-muted-foreground">Microbiology workflow</p>
        </div>
        <button
          onClick={() => {
            if (confirm("Reset all data to demo seed?")) meduguActions.resetToSeed();
          }}
          className="rounded-md border border-sidebar-border px-2 py-1 text-[11px] text-sidebar-foreground hover:bg-sidebar-accent"
        >
          Reset
        </button>
      </div>

      <div className="border-b border-sidebar-border px-3 py-2">
        <button
          onClick={() => setIntakeOpen(true)}
          className="w-full rounded-md bg-primary px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-primary/90"
        >
          <span className="text-white font-bold">+</span> New accession
        </button>
      </div>

      <div
        className="border-b border-sidebar-border px-4 py-2 text-[11px] text-muted-foreground"
        title={
          isCurated
            ? `Showing a representative ${REPRESENTATIVE_CASE_LIMIT}-case view. All ${totalCount} records remain stored.`
            : undefined
        }
      >
        <span className="uppercase tracking-wide">
          Accessions ({list.length}{isCurated ? ` of ${totalCount}` : ""})
        </span>
        {isCurated && (
          <span className="mt-0.5 block normal-case">
            Representative mix across stages and capabilities
          </span>
        )}
      </div>

      <ul className="flex-1 overflow-y-auto">
        {list.map((a) => {
          const active = a.id === state.activeAccessionId;
          return (
            <li key={a.id}>
              <button
                onClick={() => meduguActions.setActive(a.id)}
                className={
                  "block w-full border-b border-sidebar-border px-4 py-3 text-left transition-colors " +
                  (active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "hover:bg-sidebar-accent/50 text-sidebar-foreground")
                }
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs">{a.id}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                    {a.priority}
                  </span>
                </div>
                <div className="mt-1 text-sm">
                  {a.patient.givenName} {a.patient.familyName}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {a.specimen.familyCode} · {a.stage}
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <NewAccessionDialog open={intakeOpen} onOpenChange={setIntakeOpen} />
    </aside>
  );
}

