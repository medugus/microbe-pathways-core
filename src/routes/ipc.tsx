// IPC dashboard — tenant-wide list of open infection-prevention episodes
// detected by the server-side IPC evaluator. Members can view; IPC,
// consultants and admins can acknowledge/resolve. Every status change writes
// an audit_event row via the audit_ipc_signal trigger.

import { useEffect, useState } from "react";
import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { SessionBar } from "@/auth/SessionBar";
import { IPCEpisodeDrawer } from "@/medugu/ui/sections/IPCEpisodeDrawer";
import {
  detailFromPersistedSignal,
  type IPCEpisodeDetail,
  type PersistedSignalLike,
} from "@/medugu/logic/ipcEpisodeDetail";
import { meduguActions } from "@/medugu/store/useAccessionStore";
import type { Accession } from "@/medugu/domain/types";

interface SignalRow {
  id: string;
  accession_id: string;
  isolate_id: string;
  rule_code: string;
  organism_code: string | null;
  phenotypes: string[];
  message: string;
  timing: string;
  actions: string[];
  notify: string[];
  mrn: string | null;
  ward: string | null;
  status: "open" | "acknowledged" | "resolved";
  raised_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
}

export const Route = createFileRoute("/ipc")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: IPCDashboardPage,
});

const STATUS_TONE: Record<SignalRow["status"], string> = {
  open: "bg-destructive/15 text-destructive",
  acknowledged: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  resolved: "bg-muted text-muted-foreground",
};

function IPCDashboardPage() {
  const { hasRole } = useAuth();
  const canAct = hasRole("ipc") || hasRole("admin") || hasRole("consultant");

  const [rows, setRows] = useState<SignalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drawerDetail, setDrawerDetail] = useState<IPCEpisodeDetail | null>(null);
  const [drawerOpening, setDrawerOpening] = useState(false);
  const navigate = useNavigate();

  async function openDrawer(row: SignalRow) {
    // Best-effort enrichment: fetch the linked accession.data so the drawer
    // can show specimen / organism display / expert-rule fingerprints. RLS
    // already scopes us to the tenant.
    setDrawerOpening(true);
    let linked: Accession | null = null;
    try {
      const { data } = await supabase
        .from("accessions")
        .select("data")
        .eq("id", row.accession_id)
        .maybeSingle();
      if (data?.data) linked = data.data as unknown as Accession;
    } catch {
      // non-fatal — drawer still renders signal-only fields
    }
    const persisted: PersistedSignalLike = {
      id: row.id,
      accession_id: row.accession_id,
      isolate_id: row.isolate_id,
      rule_code: row.rule_code,
      organism_code: row.organism_code,
      phenotypes: row.phenotypes,
      message: row.message,
      timing: row.timing,
      actions: row.actions,
      notify: row.notify,
      mrn: row.mrn,
      ward: row.ward,
      raised_at: row.raised_at,
    };
    setDrawerDetail(detailFromPersistedSignal(persisted, linked));
    setDrawerOpening(false);
  }

  async function openLinkedAccession() {
    if (!drawerDetail?.accessionRowId) return;
    // Resolve domain id (accession_code) — store keys cases by accession_code,
    // not by Postgres row id.
    const { data } = await supabase
      .from("accessions")
      .select("accession_code")
      .eq("id", drawerDetail.accessionRowId)
      .maybeSingle();
    const code = (data?.accession_code as string | undefined) ?? drawerDetail.accessionDisplayId;
    if (code) meduguActions.setActive(code);
    setDrawerDetail(null);
    void navigate({ to: "/" });
  }

  async function load() {
    setLoading(true);
    setErr(null);
    let q = (supabase.from("ipc_signals") as any)
      .select(
        "id, accession_id, isolate_id, rule_code, organism_code, phenotypes, message, timing, actions, notify, mrn, ward, status, raised_at, acknowledged_at, resolved_at, resolution_note",
      )
      .order("raised_at", { ascending: false })
      .limit(200);
    if (filter === "open") q = q.in("status", ["open", "acknowledged"]);
    const { data, error } = await q;
    if (error) setErr(error.message);
    setRows((data ?? []) as SignalRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [filter]);

  async function setStatus(
    id: string,
    next: "acknowledged" | "resolved",
    note?: string,
  ) {
    setBusyId(id);
    const patch: Record<string, unknown> = { status: next };
    if (next === "acknowledged") {
      patch.acknowledged_at = new Date().toISOString();
      patch.acknowledged_by = (await supabase.auth.getUser()).data.user?.id ?? null;
    } else {
      patch.resolved_at = new Date().toISOString();
      patch.resolved_by = (await supabase.auth.getUser()).data.user?.id ?? null;
      if (note) patch.resolution_note = note;
    }
    const { error } = await (supabase.from("ipc_signals") as any)
      .update(patch)
      .eq("id", id);
    setBusyId(null);
    if (error) {
      setErr(error.message);
      return;
    }
    await load();
  }

  const openCount = rows.filter((r) => r.status === "open").length;
  const ackCount = rows.filter((r) => r.status === "acknowledged").length;

  return (
    <div className="min-h-screen bg-background">
      <SessionBar />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">IPC episodes</h1>
            <p className="text-sm text-muted-foreground">
              Tenant-wide open infection-prevention episodes raised by the
              server. {openCount} open · {ackCount} acknowledged.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={filter === "open" ? "default" : "outline"}
              onClick={() => setFilter("open")}
            >
              Open / acknowledged
            </Button>
            <Button
              size="sm"
              variant={filter === "all" ? "default" : "outline"}
              onClick={() => setFilter("all")}
            >
              All
            </Button>
            <Link
              to="/"
              className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              ← Back
            </Link>
          </div>
        </header>

        {err && (
          <div className="mb-4 rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {err}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading episodes…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No IPC episodes match this filter.
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STATUS_TONE[r.status]}`}
                  >
                    {r.status}
                  </span>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {r.rule_code}
                  </code>
                  {r.organism_code && (
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                      {r.organism_code}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {r.timing.replaceAll("_", " ")}
                  </span>
                  {r.phenotypes.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      phenotype: {r.phenotypes.join(", ")}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-foreground">{r.message}</p>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-muted-foreground sm:grid-cols-4">
                  <div>MRN: {r.mrn ?? "—"}</div>
                  <div>Ward: {r.ward ?? "—"}</div>
                  <div>Raised: {new Date(r.raised_at).toLocaleString()}</div>
                  <div>
                    Notify: {r.notify.length > 0 ? r.notify.join(", ") : "—"}
                  </div>
                </div>
                {r.resolution_note && (
                  <p className="mt-2 rounded bg-muted/50 p-2 text-xs text-muted-foreground">
                    Resolution: {r.resolution_note}
                  </p>
                )}
                {canAct && r.status !== "resolved" && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {r.status === "open" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === r.id}
                        onClick={() => void setStatus(r.id, "acknowledged")}
                      >
                        {busyId === r.id ? "…" : "Acknowledge"}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      disabled={busyId === r.id}
                      onClick={() => {
                        const note = window.prompt(
                          "Resolution note (optional):",
                          "",
                        );
                        if (note === null) return; // cancelled
                        void setStatus(r.id, "resolved", note || undefined);
                      }}
                    >
                      {busyId === r.id ? "…" : "Resolve"}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
