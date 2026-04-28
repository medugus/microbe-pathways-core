// DispatchHistoryPanel — browser-phase mock transport UI.
//
// SCOPE: not a real outbound integration. The simulate / retry buttons call
// server functions that DO NOT POST to any external receiver. They generate
// the wire payload from the FROZEN release_packages row only and write a
// dispatch_history attempt with status sent / failed. The DB trigger emits
// dispatch.requested / .sent / .failed / .retried audit events.
//
// All dispatch logic lives in src/medugu/store/dispatch.functions.ts. This
// component only renders state and binds buttons.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  retryDispatch,
  simulateDispatch,
  type DispatchHistoryRow,
  type DispatchStatus,
} from "../../store/dispatch.functions";
import type { ExportFormat } from "../../logic/exportEngine";
import { soundEngine } from "../../logic/soundEngine";

interface Props {
  accessionRowId: string;
}

interface PackageOpt {
  id: string;
  version: number;
}

const FORMAT_OPTS: ExportFormat[] = ["fhir", "hl7", "json"];

const STATUS_STYLE: Record<DispatchStatus, string> = {
  queued: "chip chip-square chip-neutral",
  sent: "chip chip-square chip-success",
  failed: "chip chip-square chip-danger",
  cancelled: "chip chip-square chip-warning",
};

export function DispatchHistoryPanel({ accessionRowId }: Props) {
  const [rows, setRows] = useState<DispatchHistoryRow[] | null>(null);
  const [packages, setPackages] = useState<PackageOpt[]>([]);
  const [pkgId, setPkgId] = useState<string>("");
  const [format, setFormat] = useState<ExportFormat>("fhir");
  const [receiverName, setReceiverName] = useState("mock-receiver");
  const [forceFail, setForceFail] = useState<"random" | "ok" | "fail">("random");
  const [busy, setBusy] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    const [{ data: pkgs, error: pErr }, { data: drows, error: dErr }] = await Promise.all([
      supabase
        .from("release_packages")
        .select("id, version")
        .eq("accession_id", accessionRowId)
        .order("version", { ascending: false }),
      supabase
        .from("dispatch_history")
        .select(
          "id, release_package_id, release_version, receiver_name, format, status, attempt_no, parent_dispatch_id, error_message, simulated_failure, payload_bytes, requested_at, completed_at",
        )
        .eq("accession_id", accessionRowId)
        .order("requested_at", { ascending: false }),
    ]);
    if (pErr) {
      setError(pErr.message);
      return;
    }
    if (dErr) {
      setError(dErr.message);
      return;
    }
    const opts = (pkgs ?? []) as PackageOpt[];
    setPackages(opts);
    if (opts.length > 0 && !pkgId) setPkgId(opts[0].id);
    setRows((drows ?? []) as unknown as DispatchHistoryRow[]);
  }, [accessionRowId, pkgId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onSimulate() {
    if (!pkgId) return;
    setBusy(true);
    setMsg(null);
    try {
      const result = await simulateDispatch({
        data: {
          releasePackageId: pkgId,
          format,
          receiverName: receiverName.trim() || "mock-receiver",
          forceFail: forceFail === "fail" ? true : forceFail === "ok" ? false : undefined,
        },
      });
      setMsg(
        result.ok
          ? `Simulated dispatch sent (attempt #${result.row?.attempt_no}).`
          : `Simulated dispatch failed: ${result.row?.error_message ?? result.reason ?? "unknown"}`,
      );
      if (!result.ok) {
        soundEngine.emit({
          cls: "urgent",
          key: `dispatch-fail:sim:${result.row?.id ?? Date.now()}`,
          label: `Dispatch failed (${format})`,
        });
      }
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onRetry(id: string) {
    setRetryingId(id);
    setMsg(null);
    try {
      const result = await retryDispatch({ data: { dispatchId: id } });
      setMsg(
        result.ok
          ? `Retry succeeded (attempt #${result.row?.attempt_no}).`
          : `Retry failed: ${result.row?.error_message ?? result.reason ?? "unknown"}`,
      );
      if (!result.ok) {
        soundEngine.emit({
          cls: "urgent",
          key: `dispatch-fail:retry:${id}:${Date.now()}`,
          label: `Dispatch retry failed`,
        });
      }
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <section className="rounded-md border border-border bg-card p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Dispatch history (mock transport)
        </h4>
        <span className="chip chip-square chip-warning uppercase">
          Browser-phase only — no external delivery
        </span>
      </div>

      {error && (
        <p className="mb-2 text-[11px] text-destructive">History failed: {error}</p>
      )}

      {/* Simulate panel */}
      {packages.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          No release packages yet — seal a release first.
        </p>
      ) : (
        <div className="grid gap-2 rounded border border-border bg-background p-2 sm:grid-cols-[auto_auto_auto_1fr_auto]">
          <select
            value={pkgId}
            onChange={(e) => setPkgId(e.target.value)}
            className="h-8 rounded border border-input bg-background px-2 text-[11px]"
          >
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                v{p.version}
              </option>
            ))}
          </select>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as ExportFormat)}
            className="h-8 rounded border border-input bg-background px-2 text-[11px]"
          >
            {FORMAT_OPTS.map((f) => (
              <option key={f} value={f}>
                {f.toUpperCase()}
              </option>
            ))}
          </select>
          <select
            value={forceFail}
            onChange={(e) => setForceFail(e.target.value as "random" | "ok" | "fail")}
            className="h-8 rounded border border-input bg-background px-2 text-[11px]"
            title="Outcome simulation"
          >
            <option value="random">Random outcome</option>
            <option value="ok">Force success</option>
            <option value="fail">Force failure</option>
          </select>
          <input
            type="text"
            value={receiverName}
            onChange={(e) => setReceiverName(e.target.value)}
            placeholder="mock-receiver"
            className="h-8 rounded border border-input bg-background px-2 text-[11px]"
          />
          <button
            type="button"
            onClick={onSimulate}
            disabled={busy || !pkgId}
            className="h-8 rounded bg-primary px-3 text-[11px] font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Simulating…" : "Simulate dispatch"}
          </button>
        </div>
      )}

      {msg && <p className="mt-2 text-[11px] text-foreground">{msg}</p>}

      {/* History list */}
      <div className="mt-3">
        {rows === null ? (
          <p className="text-[11px] text-muted-foreground">Loading dispatch history…</p>
        ) : rows.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            No dispatch attempts yet for this accession.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {rows.map((r) => {
              const canRetry = r.status === "failed";
              return (
                <li
                  key={r.id}
                  className="rounded border border-border bg-background p-2"
                >
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${STATUS_STYLE[r.status]}`}
                    >
                      {r.status}
                    </span>
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">
                      v{r.release_version}
                    </span>
                    <span className="font-medium text-foreground">
                      {r.receiver_name}
                    </span>
                    <span className="text-muted-foreground">[{r.format.toUpperCase()}]</span>
                    <span className="text-muted-foreground">attempt #{r.attempt_no}</span>
                    {r.parent_dispatch_id && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        retry of {r.parent_dispatch_id.slice(0, 8)}…
                      </span>
                    )}
                    {r.payload_bytes !== null && (
                      <span className="text-[10px] text-muted-foreground">
                        {r.payload_bytes} B
                      </span>
                    )}
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {new Date(r.requested_at).toLocaleString()}
                    </span>
                    {canRetry && (
                      <button
                        type="button"
                        onClick={() => onRetry(r.id)}
                        disabled={retryingId === r.id}
                        className="rounded border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground hover:bg-muted/70 disabled:opacity-50"
                      >
                        {retryingId === r.id ? "Retrying…" : "Retry"}
                      </button>
                    )}
                  </div>
                  {r.error_message && (
                    <p className="mt-1 text-[10px] text-destructive">
                      {r.error_message}
                    </p>
                  )}
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    id: {r.id}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="mt-2 text-[10px] text-muted-foreground">
        Mock dispatch only — no external receiver transport in this build.
        Payloads are regenerated server-side from the frozen ReleasePackage and
        never POSTed externally. Audit log records every request, retry, send
        and failure.
      </p>
    </section>
  );
}
