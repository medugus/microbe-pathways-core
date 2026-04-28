// ExportSection — surfaces governed FHIR / HL7 / normalised-JSON exports.
// Local copy/download remain client-side. The "Dispatch to receiver" panel
// hands off to the server, which loads the immutable release_packages row,
// regenerates the payload server-side, POSTs it to the configured receiver
// (with bearer token never exposed to the browser), and records the
// delivery + audit row.

import { useEffect, useMemo, useState } from "react";
import { useActiveAccession } from "../../store/useAccessionStore";
import {
  buildExport,
  evaluateExportGate,
  type ExportFormat,
} from "../../logic/exportEngine";
import { copyText, downloadText } from "../../utils/exportHelpers";
import { dispatchExport } from "../../store/export.functions";
import { supabase } from "@/integrations/supabase/client";
import { ReleaseState } from "../../domain/enums";
import { soundEngine } from "../../logic/soundEngine";

interface ReceiverOpt {
  id: string;
  name: string;
  format: ExportFormat;
  enabled: boolean;
  endpoint_url: string;
}

interface DeliveryRow {
  id: string;
  receiver_id: string;
  format: string;
  http_status: number | null;
  error_message: string | null;
  dispatched_at: string;
}

const FORMATS: { code: ExportFormat; label: string; hint: string }[] = [
  { code: "fhir", label: "FHIR R4 Bundle (JSON)", hint: "DiagnosticReport + Patient + Specimen + Observations" },
  { code: "hl7", label: "HL7 v2.5 ORU^R01", hint: "MSH / PID / PV1 / OBR / OBX / NTE" },
  { code: "json", label: "Normalised JSON", hint: "Stable schema for downstream pipelines" },
];

export function ExportSection() {
  const accession = useActiveAccession();
  const [active, setActive] = useState<ExportFormat>("fhir");
  const [copied, setCopied] = useState<string | null>(null);
  const [receivers, setReceivers] = useState<ReceiverOpt[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [selectedReceiver, setSelectedReceiver] = useState<string>("");
  const [dispatching, setDispatching] = useState(false);
  const [dispatchMsg, setDispatchMsg] = useState<string | null>(null);
  const [dispatchOk, setDispatchOk] = useState<boolean | null>(null);

  const gate = useMemo(() => (accession ? evaluateExportGate(accession) : null), [accession]);
  const payload = useMemo(
    () => (accession && gate?.available ? buildExport(accession, active) : null),
    [accession, active, gate?.available],
  );

  const isReleased =
    accession?.release.state === ReleaseState.Released ||
    accession?.release.state === ReleaseState.Amended;

  // Load tenant receivers + this accession's prior deliveries.
  useEffect(() => {
    if (!accession) return;
    void (async () => {
      const [{ data: rcvs }, { data: row }] = await Promise.all([
        supabase
          .from("receivers")
          .select("id, name, format, enabled, endpoint_url")
          .order("name"),
        supabase
          .from("accessions")
          .select("id")
          .eq("accession_code", accession.accessionNumber)
          .maybeSingle(),
      ]);
      setReceivers((rcvs ?? []) as ReceiverOpt[]);
      if (row?.id) {
        const { data: dlv } = await supabase
          .from("export_deliveries")
          .select("id, receiver_id, format, http_status, error_message, dispatched_at")
          .eq("accession_id", row.id as string)
          .order("dispatched_at", { ascending: false })
          .limit(10);
        setDeliveries((dlv ?? []) as DeliveryRow[]);
      }
    })();
  }, [accession?.accessionNumber, dispatchMsg]);

  async function dispatch() {
    if (!accession || !selectedReceiver) return;
    setDispatching(true);
    setDispatchMsg(null);
    setDispatchOk(null);
    try {
      const { data: row, error: lookupErr } = await supabase
        .from("accessions")
        .select("id")
        .eq("accession_code", accession.accessionNumber)
        .maybeSingle();
      if (lookupErr) throw new Error(lookupErr.message);
      if (!row) throw new Error("Accession not found in cloud.");
      const result = await dispatchExport({
        data: { accessionRowId: row.id as string, receiverId: selectedReceiver },
      });
      setDispatchOk(result.ok);
      setDispatchMsg(
        result.ok
          ? `Delivered (HTTP ${result.httpStatus ?? "n/a"}).`
          : `${result.reason ?? "Dispatch failed"} (HTTP ${result.httpStatus ?? "n/a"}).`,
      );
      if (!result.ok) {
        soundEngine.emit({
          cls: "urgent",
          key: `dispatch-fail:export:${row.id}:${Date.now()}`,
          label: "Dispatch failed",
        });
      }
    } catch (e) {
      setDispatchOk(false);
      setDispatchMsg(e instanceof Error ? e.message : String(e));
      soundEngine.emit({
        cls: "urgent",
        key: `dispatch-fail:export-exc:${Date.now()}`,
        label: "Dispatch exception",
      });
    } finally {
      setDispatching(false);
    }
  }

  if (!accession) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No active accession.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-border bg-background p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Export status</div>
            <div className={`text-sm font-medium ${gate?.available ? "text-foreground" : "text-destructive"}`}>
              {gate?.available ? "Export available" : "Export blocked"}
            </div>
            {!gate?.available && gate?.reason && (
              <p className="mt-1 text-[11px] text-destructive">{gate.reason}</p>
            )}
            {gate?.available && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Source:{" "}
                <span className="font-mono">
                  {gate.fromReleasePackage ? "frozen ReleasePackage" : "validated live preview"}
                </span>
              </p>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground">
            <div>rules: <span className="font-mono">{gate?.versions.rule}</span></div>
            <div>breakpoints: <span className="font-mono">{gate?.versions.breakpoint}</span></div>
            <div>export: <span className="font-mono">{gate?.versions.export}</span></div>
            <div>build: <span className="font-mono">{gate?.versions.build}</span></div>
          </div>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap gap-2">
          {FORMATS.map((f) => (
            <button
              key={f.code}
              type="button"
              onClick={() => setActive(f.code)}
              className={`rounded border px-3 py-1.5 text-xs ${
                active === f.code
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {FORMATS.find((f) => f.code === active)?.hint}
        </p>
      </section>

      {payload ? (
        <section className="rounded-md border border-border bg-card">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
            <div className="text-xs">
              <span className="font-mono text-muted-foreground">{payload.filename}</span>
              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {payload.mime}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  const ok = await copyText(payload.content);
                  setCopied(ok ? payload.format : null);
                  setTimeout(() => setCopied(null), 1500);
                }}
                className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
              >
                {copied === payload.format ? "Copied ✓" : "Copy"}
              </button>
              <button
                type="button"
                onClick={() => downloadText(payload.filename, payload.mime, payload.content)}
                className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:opacity-90"
              >
                Download
              </button>
            </div>
          </header>
          <pre className="max-h-96 overflow-auto bg-muted p-3 font-mono text-[11px] leading-relaxed text-foreground">
            {payload.content}
          </pre>
        </section>
      ) : (
        <p className="rounded-md border border-dashed border-border bg-card p-4 text-xs text-muted-foreground">
          Export payload will appear here once the report is released (or has zero validation blockers).
        </p>
      )}

      <p className="text-[10px] text-muted-foreground">
        Local copy/download is client-side. Server dispatch (below) regenerates
        the payload from the immutable release package and records the delivery.
      </p>

      {isReleased && (
        <section className="rounded-md border border-border bg-card p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Dispatch to receiver
          </h4>
          {receivers.length === 0 ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              No receivers configured. An admin can add one in /admin/receivers.
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                value={selectedReceiver}
                onChange={(e) => setSelectedReceiver(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="">Select receiver…</option>
                {receivers.map((r) => (
                  <option key={r.id} value={r.id} disabled={!r.enabled}>
                    {r.name} · {r.format.toUpperCase()}
                    {!r.enabled ? " (disabled)" : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={dispatch}
                disabled={!selectedReceiver || dispatching}
                className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                {dispatching ? "Dispatching on server…" : "Dispatch"}
              </button>
              {dispatchMsg && (
                <span
                  className={`text-[11px] ${
                    dispatchOk ? "text-foreground" : "text-destructive"
                  }`}
                >
                  {dispatchMsg}
                </span>
              )}
            </div>
          )}

          {deliveries.length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Recent deliveries
              </div>
              <ul className="mt-1 space-y-1">
                {deliveries.map((d) => {
                  const ok =
                    d.http_status !== null &&
                    d.http_status >= 200 &&
                    d.http_status < 300;
                  const rcvName =
                    receivers.find((r) => r.id === d.receiver_id)?.name ?? d.receiver_id;
                  return (
                    <li
                      key={d.id}
                      className="flex items-center justify-between gap-2 rounded border border-border bg-background px-2 py-1 text-[11px]"
                    >
                      <span className="truncate">
                        <span className="font-mono">{d.format.toUpperCase()}</span> →{" "}
                        {rcvName}
                      </span>
                      <span
                        className={`font-mono ${ok ? "text-foreground" : "text-destructive"}`}
                      >
                        {d.http_status ?? "ERR"}
                        {d.error_message ? ` · ${d.error_message.slice(0, 40)}` : ""}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(d.dispatched_at).toLocaleString()}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
