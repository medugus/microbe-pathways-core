// ReleaseSection — finalisation surface.
// Release sealing now runs on the server: the client calls sealRelease(),
// the server re-validates against the persisted accession, computes the
// SHA-256 seal, and writes both the immutable release_packages row and the
// updated accession in one trip. The browser cannot bypass releaseAllowed.

import { useEffect, useState } from "react";
import { useActiveAccession, meduguActions } from "../../store/useAccessionStore";
import { useAuthoritativeValidation } from "../../store/useAuthoritativeValidation";
import { transition, nextSuggested } from "../../logic/workflowEngine";
import { WorkflowStage, ReleaseState } from "../../domain/enums";
import { newId } from "../../domain/ids";
import { sealRelease, amendRelease } from "../../store/release.functions";
import { configStore } from "../../store/configStore";
import { receiverPrefs } from "../../store/receiverPrefs";
import type { AutoDispatchResult } from "../../store/export.functions";
import { supabase } from "@/integrations/supabase/client";
import type { Accession } from "../../domain/types";
import { ReleaseGate } from "./ReleaseGate";
import { ReleaseSealPanel } from "./ReleaseSealPanel";
import { AmendmentPanel } from "./AmendmentPanel";
import { ReleaseHistoryEmbed } from "./ReleaseHistoryEmbed";

export function ReleaseSection() {
  const accession = useActiveAccession();
  const [consultantName, setConsultantName] = useState("");
  const [consultantReason, setConsultantReason] = useState("");
  const [sealing, setSealing] = useState(false);
  const [sealError, setSealError] = useState<string | null>(null);
  const [amendmentReason, setAmendmentReason] = useState("");
  const [amending, setAmending] = useState(false);
  const [amendError, setAmendError] = useState<string | null>(null);
  const [accessionRowId, setAccessionRowId] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [autoDispatch, setAutoDispatch] = useState<AutoDispatchResult[] | null>(null);

  // Resolve the postgres row id once per accession so the history panel can
  // query release_packages by FK without re-issuing the lookup on every render.
  const accessionCode = accession?.accessionNumber ?? null;
  useEffect(() => {
    let cancelled = false;
    if (!accessionCode) {
      setAccessionRowId(null);
      return;
    }
    void supabase
      .from("accessions")
      .select("id")
      .eq("accession_code", accessionCode)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setAccessionRowId((data?.id as string | null) ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [accessionCode]);

  if (!accession) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No active accession.
      </div>
    );
  }

  const validation = useAuthoritativeValidation(accession, accessionRowId);
  const v = validation.report;
  const suggestedNext = nextSuggested(accession.workflowStatus);
  const released =
    accession.release.state === ReleaseState.Released ||
    accession.release.state === ReleaseState.Amended;

  function advance(to: WorkflowStage) {
    if (!accession) return;
    const r = transition(accession, to);
    if (r.audit) {
      // Persist audit even when blocked, but only change stage on success.
      if (r.ok) {
        meduguActions.setWorkflowStage(accession.id, to, r.audit);
      }
    }
  }

  function recordPhoneOut() {
    if (!accession) return;
    meduguActions.recordPhoneOut(accession.id, {
      id: newId("po"),
      at: new Date().toISOString(),
      calledBy: "local",
      recipient: accession.patient.attendingClinician ?? "On-call clinician",
      reasonCode: "critical_value",
      message: `Significant result on ${accession.accessionNumber}`,
      acknowledged: true,
      acknowledgedAt: new Date().toISOString(),
    });
  }

  function approveConsultant() {
    if (!accession || !consultantName.trim()) return;
    meduguActions.recordConsultantApproval(accession.id, {
      approvedBy: consultantName.trim(),
      reason: consultantReason.trim() || undefined,
    });
    setConsultantName("");
    setConsultantReason("");
  }

  async function release() {
    if (!accession) return;
    setSealError(null);
    setSealing(true);
    try {
      // Find the postgres row id for this accession (cloudSync uses
      // accession_code as the natural key per tenant).
      const { data: row, error: lookupErr } = await supabase
        .from("accessions")
        .select("id, tenant_id")
        .eq("accession_code", accession.accessionNumber)
        .maybeSingle();
      if (lookupErr) throw new Error(lookupErr.message);
      if (!row) throw new Error("Accession not found in cloud — try again in a moment.");

      const result = await sealRelease({
        data: {
          accessionRowId: row.id as string,
          configVersion: configStore.getActiveVersion(),
          excludedReceiverIds: receiverPrefs.getExcludedReceiverIds(row.tenant_id as string),
        },
      });
      if (!result.ok || !result.accessionJson) {
        const codes = result.blockerCodes?.length ? ` (${result.blockerCodes.join(", ")})` : "";
        setSealError((result.reason ?? "Release blocked") + codes);
        return;
      }
      // Replace the local copy with the server-issued sealed accession.
      const sealed = JSON.parse(result.accessionJson) as Accession;
      meduguActions.upsertAccession(sealed);
      setAutoDispatch(result.autoDispatch ?? []);
      setHistoryKey((k) => k + 1);
    } catch (err) {
      setSealError(err instanceof Error ? err.message : String(err));
    } finally {
      setSealing(false);
    }
  }

  async function amend() {
    if (!accession) return;
    setAmendError(null);
    if (amendmentReason.trim().length < 4) {
      setAmendError("Amendment reason is required (min 4 characters).");
      return;
    }
    setAmending(true);
    try {
      const { data: row, error: lookupErr } = await supabase
        .from("accessions")
        .select("id, tenant_id")
        .eq("accession_code", accession.accessionNumber)
        .maybeSingle();
      if (lookupErr) throw new Error(lookupErr.message);
      if (!row) throw new Error("Accession not found in cloud.");

      const result = await amendRelease({
        data: {
          accessionRowId: row.id as string,
          amendmentReason: amendmentReason.trim(),
          configVersion: configStore.getActiveVersion(),
          excludedReceiverIds: receiverPrefs.getExcludedReceiverIds(row.tenant_id as string),
        },
      });
      if (!result.ok || !result.accessionJson) {
        const codes = result.blockerCodes?.length ? ` (${result.blockerCodes.join(", ")})` : "";
        setAmendError((result.reason ?? "Amendment blocked") + codes);
        return;
      }
      const amended = JSON.parse(result.accessionJson) as Accession;
      meduguActions.upsertAccession(amended);
      setAmendmentReason("");
      setAutoDispatch(result.autoDispatch ?? []);
      setHistoryKey((k) => k + 1);
    } catch (err) {
      setAmendError(err instanceof Error ? err.message : String(err));
    } finally {
      setAmending(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Workflow */}
      <section className="rounded-md border border-border bg-background p-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Workflow
        </h4>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded bg-muted px-2 py-1 text-foreground">
            current: <span className="font-mono">{accession.workflowStatus}</span>
          </span>
          {suggestedNext && !released && (
            <button
              type="button"
              onClick={() => advance(suggestedNext)}
              className="rounded border border-border px-2 py-1 hover:bg-muted"
            >
              advance → {suggestedNext}
            </button>
          )}
          {!released && (
            <button
              type="button"
              onClick={() => advance(WorkflowStage.Validation)}
              className="rounded border border-border px-2 py-1 hover:bg-muted"
            >
              jump → validation
            </button>
          )}
        </div>
      </section>

      {/* Validation source badge */}
      <ValidationSourceBadge validation={validation} />

      <ReleaseGate
        accession={accession}
        validationReport={v}
        consultantName={consultantName}
        consultantReason={consultantReason}
        setConsultantName={setConsultantName}
        setConsultantReason={setConsultantReason}
        onApproveConsultant={approveConsultant}
        onRecordPhoneOut={recordPhoneOut}
      />

      <ReleaseSealPanel
        accession={accession}
        validationReport={v}
        sealing={sealing}
        sealError={sealError}
        autoDispatch={autoDispatch}
        onRelease={release}
      />

      <AmendmentPanel
        accession={accession}
        amendmentReason={amendmentReason}
        amending={amending}
        amendError={amendError}
        setAmendmentReason={setAmendmentReason}
        onAmend={amend}
      />

      <ReleaseHistoryEmbed accessionRowId={accessionRowId} historyKey={historyKey} />
    </div>
  );
}

// ---------- Validation source badge ----------
//
// Tells the operator whether the blockers/warnings on screen came from the
// server-authoritative engine or the local fallback. Pale-on-tone so it never
// out-shouts the actual blocker count, but legible at a glance.

import type { AuthoritativeValidation } from "../../store/useAuthoritativeValidation";

function ValidationSourceBadge({ validation }: { validation: AuthoritativeValidation }) {
  const { source, loading, fallbackReason, lastServerAt } = validation;

  let label: string;
  let toneClass: string;
  let title: string | undefined;
  switch (source) {
    case "server":
      label = "server-authoritative";
      toneClass = "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
      title = lastServerAt
        ? `Validation report received from server at ${new Date(lastServerAt).toLocaleTimeString()}.`
        : "Validation report received from server.";
      break;
    case "client-fallback":
      label = "client fallback (server unavailable)";
      toneClass = "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
      title = fallbackReason ?? "Server validation request failed; showing local engine output.";
      break;
    case "client":
    default:
      label = "client engine";
      toneClass = "border-border bg-muted text-muted-foreground";
      title = fallbackReason ?? "PHASE5_SERVER_VALIDATION is disabled; local engine is the contract.";
      break;
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-md border px-2 py-1 text-[11px] ${toneClass}`}
      title={title}
      aria-live="polite"
    >
      <span className="font-medium uppercase tracking-wide">Validation:</span>
      <span>{label}</span>
      {loading && <span className="opacity-70">· checking server…</span>}
    </div>
  );
}
