import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  OutbreakCandidatePair,
  OutbreakSurveillanceSummary,
} from "../../logic/outbreakEngine";

interface OutbreakIncidentRow {
  id: string;
  candidate_pair_id: string;
  status: "open" | "under_investigation" | "escalated" | "resolved" | "dismissed";
  severity: OutbreakCandidatePair["severity"];
  score: number;
  organism_display: string;
  first_accession_id: string;
  first_accession_number: string | null;
  second_accession_id: string;
  second_accession_number: string | null;
  ward_summary: string | null;
  opened_at: string;
  updated_at: string;
  resolution_note: string | null;
}

const db = supabase as unknown as { from: (table: string) => any };

type IncidentStatus = OutbreakIncidentRow["status"];

function persistenceErrorMessage(error: { message: string; code?: string | null }) {
  if (
    error.code === "PGRST205" ||
    error.message.includes("outbreak_incidents") ||
    error.message.includes("schema cache")
  ) {
    return "Persistent outbreak incidents are not initialized on this deployment. Apply the latest Supabase migrations and refresh the API schema.";
  }
  return error.message;
}

function formatDateTime(value?: string | null): string {
  if (!value) return "not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusClass(status: IncidentStatus): string {
  if (status === "open") return "border-destructive/40 bg-destructive/10 text-destructive";
  if (status === "under_investigation") return "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300";
  if (status === "escalated") return "border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300";
  if (status === "resolved") return "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300";
  return "border-muted bg-muted text-muted-foreground";
}

function statusLabel(status: IncidentStatus): string {
  return status.replace(/_/g, " ");
}

function wardSummary(pair: OutbreakCandidatePair): string {
  const firstWard = pair.first.ward ?? "ward unavailable";
  const secondWard = pair.second.ward ?? "ward unavailable";
  return pair.sameWard ? firstWard : `${firstWard} / ${secondWard}`;
}

function selectedPairLabel(pair: OutbreakCandidatePair | null): string {
  if (!pair) return "No pair selected";
  return `${pair.first.accessionNumber} + ${pair.second.accessionNumber}`;
}

export function OutbreakIncidentRegister({
  pair,
  summary,
}: {
  pair: OutbreakCandidatePair | null;
  summary: OutbreakSurveillanceSummary;
}) {
  const [incidents, setIncidents] = useState<OutbreakIncidentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openIncidentCount = useMemo(
    () => incidents.filter((incident) => !["resolved", "dismissed"].includes(incident.status)).length,
    [incidents],
  );

  async function loadIncidents() {
    setLoading(true);
    setError(null);
    const { data, error } = await db
      .from("outbreak_incidents")
      .select(
        "id, candidate_pair_id, status, severity, score, organism_display, first_accession_id, first_accession_number, second_accession_id, second_accession_number, ward_summary, opened_at, updated_at, resolution_note",
      )
      .order("updated_at", { ascending: false })
      .limit(12);

    if (error) {
      setError(persistenceErrorMessage(error));
      setIncidents([]);
    } else {
      setIncidents((data ?? []) as OutbreakIncidentRow[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadIncidents();
  }, []);

  async function openIncident() {
    if (!pair) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const { data: existing, error: existingError } = await db
        .from("outbreak_incidents")
        .select("id, status")
        .eq("candidate_pair_id", pair.id)
        .maybeSingle();

      if (existingError) throw existingError;
      if (existing?.id) {
        setMessage(`Incident already exists and is ${statusLabel(existing.status)}.`);
        await loadIncidents();
        return;
      }

      const { data: auth } = await supabase.auth.getUser();
      const { error: insertError } = await db.from("outbreak_incidents").insert({
        candidate_pair_id: pair.id,
        status: "open",
        severity: pair.severity,
        score: pair.score,
        organism_code: pair.first.organismCode,
        organism_display: pair.first.organismDisplay,
        first_accession_id: pair.first.accessionId,
        first_accession_number: pair.first.accessionNumber,
        first_isolate_id: pair.first.isolateId,
        second_accession_id: pair.second.accessionId,
        second_accession_number: pair.second.accessionNumber,
        second_isolate_id: pair.second.isolateId,
        ward_summary: wardSummary(pair),
        reasons: pair.reasons,
        actions: pair.recommendedActions,
        handoff: pair.ipcHandoff,
        snapshots: { first: pair.first, second: pair.second },
        opened_by: auth.user?.id ?? null,
      });

      if (insertError) throw insertError;
      setMessage("Outbreak incident opened for IPC review.");
      await loadIncidents();
    } catch (e) {
      setError(e instanceof Error ? persistenceErrorMessage(e) : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(id: string, status: IncidentStatus) {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const patch: Record<string, unknown> = { status };
      if (status === "under_investigation" || status === "escalated") {
        patch.acknowledged_at = new Date().toISOString();
        patch.acknowledged_by = auth.user?.id ?? null;
      }
      if (status === "resolved" || status === "dismissed") {
        patch.resolved_at = new Date().toISOString();
        patch.resolved_by = auth.user?.id ?? null;
        patch.resolution_note = status === "resolved" ? "Resolved from LIMS outbreak register." : "Dismissed as not epidemiologically linked.";
      }

      const { error } = await db.from("outbreak_incidents").update(patch).eq("id", id);
      if (error) throw error;
      setMessage(`Incident marked ${statusLabel(status)}.`);
      await loadIncidents();
    } catch (e) {
      setError(e instanceof Error ? persistenceErrorMessage(e) : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-md border border-border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Persistent outbreak register
          </h5>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Opens a live phenotypic candidate pair into a durable IPC/outbreak incident so the investigation survives browser reset, demo refresh, and handover.
          </p>
        </div>
        <button
          type="button"
          onClick={openIncident}
          disabled={!pair || busy}
          className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Working..." : "Open IPC incident"}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <RegisterMetric label="Live candidate pairs" value={summary.candidatePairCount} />
        <RegisterMetric label="High priority" value={summary.highRiskPairCount} />
        <RegisterMetric label="Open incidents" value={openIncidentCount} />
        <RegisterMetric label="Selected pair" value={selectedPairLabel(pair)} compact />
      </div>

      {message && (
        <p className="mt-3 rounded border border-emerald-500/30 bg-emerald-50 p-2 text-xs text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-3 text-xs text-muted-foreground">Loading persistent incidents...</p>
      ) : incidents.length === 0 ? (
        <p className="mt-3 rounded border border-dashed border-border bg-background p-3 text-xs text-muted-foreground">
          No persistent outbreak incidents yet. Select a candidate pair and open an IPC incident when the signal is clinically plausible.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {incidents.map((incident) => (
            <li key={incident.id} className="rounded border border-border bg-background p-3 text-xs">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusClass(incident.status)}`}>
                      {statusLabel(incident.status)}
                    </span>
                    <span className="font-semibold text-foreground">{incident.organism_display}</span>
                    <span className="text-muted-foreground">Score {incident.score}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {(incident.first_accession_number ?? incident.first_accession_id)} + {(incident.second_accession_number ?? incident.second_accession_id)}
                    {incident.ward_summary ? ` - ${incident.ward_summary}` : ""}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Opened {formatDateTime(incident.opened_at)} - updated {formatDateTime(incident.updated_at)}
                  </p>
                  {incident.resolution_note && (
                    <p className="mt-2 rounded bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                      {incident.resolution_note}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => updateStatus(incident.id, "under_investigation")}
                    disabled={busy || incident.status === "under_investigation"}
                    className="rounded border border-border px-2 py-1 text-[10px] hover:bg-muted disabled:opacity-50"
                  >
                    Investigating
                  </button>
                  <button
                    type="button"
                    onClick={() => updateStatus(incident.id, "escalated")}
                    disabled={busy || incident.status === "escalated"}
                    className="rounded border border-border px-2 py-1 text-[10px] hover:bg-muted disabled:opacity-50"
                  >
                    Escalate
                  </button>
                  <button
                    type="button"
                    onClick={() => updateStatus(incident.id, "resolved")}
                    disabled={busy || incident.status === "resolved"}
                    className="rounded border border-border px-2 py-1 text-[10px] hover:bg-muted disabled:opacity-50"
                  >
                    Resolve
                  </button>
                  <button
                    type="button"
                    onClick={() => updateStatus(incident.id, "dismissed")}
                    disabled={busy || incident.status === "dismissed"}
                    className="rounded border border-border px-2 py-1 text-[10px] hover:bg-muted disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RegisterMetric({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: number | string;
  compact?: boolean;
}) {
  return (
    <div className="rounded border border-border bg-background p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 font-semibold text-foreground ${compact ? "truncate text-xs" : "text-sm"}`}>
        {value}
      </div>
    </div>
  );
}
