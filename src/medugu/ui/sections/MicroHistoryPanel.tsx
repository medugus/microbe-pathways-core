import { useMemo } from "react";
import { useActiveAccession, useMeduguState } from "../../store/useAccessionStore";
import {
  derivePatientMicrobiologyHistory,
  type PriorHistoryRow,
} from "../../logic/microHistoryEngine";

function formatIso(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

function RelevanceBadges({ row }: { row: PriorHistoryRow }) {
  const items: string[] = [];
  if (row.repeatOrganism) {
    items.push(
      "Repeat organism detected in prior accession. Review clinical context before interpreting as recurrence.",
    );
  }
  if (row.priorIPCSignal || row.priorPhenotypes.length > 0) {
    items.push("Prior MDRO phenotype recorded. Review IPC and AMS context.");
  }
  if (row.priorColonisationPositive) {
    items.push("Prior colonisation screen positive for one or more organisms.");
  }
  if (row.astComparisons.some((c) => c.worsening)) {
    items.push(
      "Current AST shows reduced susceptibility compared with prior result for one or more agents.",
    );
  }
  if (row.sameSpecimenSourceRecurrence) {
    items.push("Same specimen source noted across prior and current accessions.");
  }

  if (items.length === 0)
    return <span className="text-muted-foreground">No direct comparator signal.</span>;

  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item} className="text-xs text-foreground">
          • {item}
        </li>
      ))}
    </ul>
  );
}

function HistoryTable({ title, rows }: { title: string; rows: PriorHistoryRow[] }) {
  return (
    <section className="space-y-2">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">None.</p>
      ) : (
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Accession</th>
                <th className="px-2 py-2">Specimen</th>
                <th className="px-2 py-2">Context</th>
                <th className="px-2 py-2">Organism</th>
                <th className="px-2 py-2">Prior phenotype</th>
                <th className="px-2 py-2">Current relevance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.accessionId} className="border-t border-border align-top">
                  <td className="px-2 py-2 font-mono">{formatIso(row.date)}</td>
                  <td className="px-2 py-2 font-mono">{row.accessionNumber}</td>
                  <td className="px-2 py-2">{row.specimenDisplay}</td>
                  <td className="px-2 py-2">
                    {row.context === "diagnostic" ? "Diagnostic culture" : "Colonisation/screening"}
                  </td>
                  <td className="px-2 py-2">
                    {row.organisms.length === 0 ? "—" : row.organisms.join(", ")}
                  </td>
                  <td className="px-2 py-2">
                    {row.priorPhenotypes.length === 0 ? "—" : row.priorPhenotypes.join(", ")}
                  </td>
                  <td className="px-2 py-2">
                    <RelevanceBadges row={row} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function MicroHistoryPanel() {
  const accession = useActiveAccession();
  const state = useMeduguState();

  const history = useMemo(() => {
    if (!accession) return null;
    return derivePatientMicrobiologyHistory(accession, state.accessions);
  }, [accession, state.accessions]);

  if (!accession || !history) return null;

  const hasAnyRows =
    history.diagnosticHistory.length + history.colonisationScreeningHistory.length > 0;

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-5">
      <header>
        <h3 className="text-lg font-semibold text-foreground">Patient microbiology history</h3>
      </header>

      {!hasAnyRows ? (
        <p className="text-sm text-muted-foreground">
          No prior microbiology accessions for this patient.
        </p>
      ) : (
        <>
          <HistoryTable title="Prior diagnostic cultures" rows={history.diagnosticHistory} />
          <HistoryTable
            title="Prior colonisation/screening"
            rows={history.colonisationScreeningHistory}
          />
        </>
      )}

      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-foreground">Current relevance</h4>
        <ul className="space-y-1 text-xs">
          {history.currentRelevance.currentMatchesPriorColonisingOrganism && (
            <li>
              • Current organism matches a prior colonising organism. Review clinical and IPC
              context.
            </li>
          )}
          {history.currentRelevance.repeatAlertOrganism && (
            <li>
              • Repeat organism detected in prior accession. Review clinical context before
              interpreting as recurrence.
            </li>
          )}
          {history.currentRelevance.priorColonisationWithRelatedHighRiskGroup && (
            <li>
              • Prior colonisation with related high-risk organism/group is present. Review clinical
              and IPC context.
            </li>
          )}
          {history.currentRelevance.susceptibilityWorsening && (
            <li>
              • Current AST shows reduced susceptibility compared with prior result for one or more
              agents.
            </li>
          )}
          {history.currentRelevance.newResistantPhenotypeFlag && (
            <li>
              • New resistant phenotype signal appears in current accession compared with available
              prior history.
            </li>
          )}
          {!history.currentRelevance.currentMatchesPriorColonisingOrganism &&
            !history.currentRelevance.repeatAlertOrganism &&
            !history.currentRelevance.priorColonisationWithRelatedHighRiskGroup &&
            !history.currentRelevance.susceptibilityWorsening &&
            !history.currentRelevance.newResistantPhenotypeFlag && (
              <li className="text-muted-foreground">
                No additional prior-history relevance signals detected.
              </li>
            )}
        </ul>
      </section>
    </div>
  );
}
