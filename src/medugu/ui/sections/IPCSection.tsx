// IPCSection — visualises IPC engine output per isolate.
// The IPC scan now runs on the server and queries every accession in the
// tenant for cross-accession rolling-window dedup (the browser store only
// ever held the cases this device had hydrated, which produced wrong
// dedup results in any multi-device session).

import { useEffect, useState } from "react";
import { useActiveAccession } from "../../store/useAccessionStore";
import { evaluateIPCServer } from "../../store/engines.functions";
import { supabase } from "@/integrations/supabase/client";
import type { IPCDecision } from "../../logic/ipcEngine";
import { detailFromDecision, type IPCEpisodeDetail } from "../../logic/ipcEpisodeDetail";
import { IPCEpisodeDrawer } from "./IPCEpisodeDrawer";

const TIMING_TONE: Record<string, string> = {
  immediate: "bg-destructive/20 text-destructive",
  same_shift: "bg-destructive/10 text-destructive",
  within_24h: "bg-muted text-foreground",
  next_business_day: "bg-muted text-muted-foreground",
};

export function IPCSection() {
  const accession = useActiveAccession();
  const [decisions, setDecisions] = useState<IPCDecision[] | null>(null);
  const [cohortSize, setCohortSize] = useState<number | null>(null);
  const [persisted, setPersisted] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerDetail, setDrawerDetail] = useState<IPCEpisodeDetail | null>(null);

  // Re-run server scan whenever the active accession or its isolate set changes.
  const accessionId = accession?.id ?? null;
  const isolateSig = accession?.isolates.map((i) => `${i.id}:${i.organismCode}`).join(",") ?? "";

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!accession) return;
      setLoading(true);
      setError(null);
      try {
        const { data: row, error: lookupErr } = await supabase
          .from("accessions")
          .select("id")
          .eq("accession_code", accession.accessionNumber)
          .maybeSingle();
        if (lookupErr) throw new Error(lookupErr.message);
        if (!row) throw new Error("Accession not yet synced.");
        const result = await evaluateIPCServer({
          data: { accessionRowId: row.id as string },
        });
        if (cancelled) return;
        if (!result.ok) {
          setError(result.reason ?? "Server rejected IPC scan.");
          setDecisions([]);
          setCohortSize(null);
          return;
        }
        setDecisions(result.decisions ?? []);
        setCohortSize(result.cohortSize ?? 0);
        setPersisted(result.persisted ?? 0);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [accessionId, isolateSig, accession]);

  if (!accession) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No active accession.
      </div>
    );
  }

  if (loading && decisions === null) {
    return <p className="text-sm text-muted-foreground">Running IPC scan on server…</p>;
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        IPC scan failed: {error}
      </p>
    );
  }

  if (!decisions || decisions.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          No IPC signals — no alert organism, phenotype, or ward trigger matched.
        </p>
        {cohortSize !== null && (
          <p className="text-[10px] text-muted-foreground">
            Server scanned {cohortSize} prior accession(s) for this MRN across the tenant.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Triggered by organism + phenotype + ward + rolling window. Cross-accession
          dedup performed server-side per MRN. Fresh signals are persisted to the
          tenant-wide IPC dashboard.
        </p>
        <div className="flex flex-col items-end gap-0.5 text-[10px] text-muted-foreground">
          {cohortSize !== null && <span>cohort: {cohortSize} prior case(s)</span>}
          {persisted !== null && persisted > 0 && (
            <span className="text-primary">
              {persisted} new episode(s) → dashboard
            </span>
          )}
        </div>
      </header>
      <ul className="space-y-2">
        {decisions.map((d, idx) => (
          <li
            key={`${d.isolateId}-${d.ruleCode}-${idx}`}
            className="cursor-pointer rounded-md border border-border bg-card p-3 transition hover:border-primary/40 hover:bg-muted/30"
            onClick={() => setDrawerDetail(detailFromDecision(accession, d))}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setDrawerDetail(detailFromDecision(accession, d));
              }
            }}
          >
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {d.ruleCode}
              </code>
              <span className={`rounded px-1.5 py-0.5 text-[10px] ${TIMING_TONE[d.timing] ?? "bg-muted"}`}>
                {d.timing.replaceAll("_", " ")}
              </span>
              {!d.isNewEpisode && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  deduped (existing episode)
                </span>
              )}
              {d.phenotypes.length > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  phenotype: {d.phenotypes.join(", ")}
                </span>
              )}
              <span className="ml-auto text-[10px] text-muted-foreground">click for detail →</span>
            </div>
            <p className="mt-1.5 text-sm text-foreground">{d.message}</p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
              {d.actions.map((a) => (
                <span key={a} className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                  {a.replaceAll("_", " ")}
                </span>
              ))}
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">
              Notify: {d.notify.join(", ")}
            </div>
            {d.clearanceProgress && (
              <div className="mt-1 text-[10px] text-muted-foreground">
                Clearance: {d.clearanceProgress.negativeCount}/{d.clearanceProgress.required} negative screens.
              </div>
            )}
          </li>
        ))}
      </ul>
      <IPCEpisodeDrawer
        open={drawerDetail !== null}
        onOpenChange={(o) => { if (!o) setDrawerDetail(null); }}
        detail={drawerDetail}
        // No "Open accession" button — we are already on this accession.
      />
    </div>
  );
}
