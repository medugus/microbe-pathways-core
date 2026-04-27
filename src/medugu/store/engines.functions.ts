// Server-authoritative engine surfaces.
//
// Stage 6: AST expert rules and IPC signals are computed on the server using
// the persisted accession data. The browser cannot fabricate phenotype flags
// (MRSA / ESBL / CRE / VRE / etc.) or skip an alert — the same engines that
// run client-side (for live preview) are run again here as the source of
// truth, and the resulting patches/signals are written back to Postgres.
//
// IPC additionally queries every accession in the tenant for cross-accession
// rolling-window dedup — this used to scan the browser's in-memory store and
// was therefore wrong in any multi-device session.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Accession } from "../domain/types";
import { evaluateAccession } from "../logic/astEngine";
import { evaluateIPC, type IPCDecision } from "../logic/ipcEngine";
import { runValidation, type ValidationReport } from "../logic/validationEngine";

// ---------- Phase-5 server-authoritative validation (feature-flagged) ----------
//
// Sprint P5-S1 step 3: port the sterile-site + IPC-critical branch of
// runValidation to the server, behind PHASE5_SERVER_VALIDATION. The browser
// engine still runs for instant UX preview, but when the flag is on, the
// release/export path treats the server response as authoritative — closing
// the DEF-001 contract gap on a multi-device session where the browser cohort
// for the IPC engine would be incomplete.

/** Feature-flag read per request (env may be hot-reloaded between deploys). */
function isServerValidationEnabled(): boolean {
  const v = (process.env.PHASE5_SERVER_VALIDATION ?? "").toLowerCase();
  return v === "1" || v === "true";
}

export interface ServerValidationResult {
  ok: boolean;
  reason?: string;
  /** True when the feature flag is enabled and the server engine ran. */
  serverAuthoritative: boolean;
  /** Full validation report (mirrors client shape). Present when ok=true and flag on. */
  report?: ValidationReport;
}

export const validateAccessionServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accessionRowId: string }) =>
    z.object({ accessionRowId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<ServerValidationResult> => {
    const { supabase } = context;

    if (!isServerValidationEnabled()) {
      return {
        ok: true,
        serverAuthoritative: false,
        reason: "PHASE5_SERVER_VALIDATION disabled — client engine remains authoritative.",
      };
    }

    const { data: row, error: loadErr } = await supabase
      .from("accessions")
      .select("id, data")
      .eq("id", data.accessionRowId)
      .maybeSingle();
    if (loadErr) throw new Error(`Load failed: ${loadErr.message}`);
    if (!row)
      return {
        ok: false,
        serverAuthoritative: true,
        reason: "Accession not found or not visible.",
      };

    const accession = row.data as unknown as Accession;
    // runValidation re-runs the same DEF-001 sterile-site + IPC-critical
    // branch the client uses. On the server, evaluateIPC inside runValidation
    // sees only the single accession passed to it (no cohort), which is
    // sufficient for sterile-site critical-alert detection — cross-accession
    // dedup is the job of evaluateIPCServer, not the validation gate.
    const report = runValidation(accession);
    return { ok: true, serverAuthoritative: true, report };
  });

// ---------- AST: server-authoritative expert rules ----------

export interface ApplyExpertRulesResult {
  ok: boolean;
  reason?: string;
  /** Number of AST rows touched. */
  patched?: number;
  /** Server-issued accession after patches, JSON-serialized. */
  accessionJson?: string;
}

export const applyExpertRulesServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accessionRowId: string }) =>
    z.object({ accessionRowId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<ApplyExpertRulesResult> => {
    const { supabase, userId } = context;

    const { data: row, error: loadErr } = await supabase
      .from("accessions")
      .select("id, version, data")
      .eq("id", data.accessionRowId)
      .maybeSingle();
    if (loadErr) throw new Error(`Load failed: ${loadErr.message}`);
    if (!row) return { ok: false, reason: "Accession not found or not visible." };

    const accession = row.data as unknown as Accession;

    // Re-run the same pure engine the client uses for preview. The result
    // is the canonical phenotype + cascade decision set.
    const outputs = evaluateAccession(accession);
    const merged: Record<string, Partial<Accession["ast"][number]>> = {};
    for (const o of outputs) {
      for (const [rid, p] of Object.entries(o.rowPatches)) {
        merged[rid] = { ...(merged[rid] ?? {}), ...p };
      }
    }

    const nextAst = accession.ast.map((r) => (merged[r.id] ? { ...r, ...merged[r.id] } : r));
    const patchedCount = Object.keys(merged).length;
    const updatedAt = new Date().toISOString();
    const next: Accession = {
      ...accession,
      ast: nextAst,
      updatedAt,
    };

    const { error: updErr } = await supabase
      .from("accessions")
      .update({
        data: next as never,
        version: row.version + 1,
        updated_by: userId,
      } as never)
      .eq("id", row.id)
      .eq("version", row.version);
    if (updErr) return { ok: false, reason: `Update failed: ${updErr.message}` };

    return {
      ok: true,
      patched: patchedCount,
      accessionJson: JSON.stringify(next),
    };
  });

// ---------- IPC: cross-accession rolling-window scan ----------

export interface IPCServerResult {
  ok: boolean;
  reason?: string;
  /** Decisions identical in shape to the client engine output. */
  decisions?: IPCDecision[];
  /** Number of prior accessions for the same MRN considered for dedup. */
  cohortSize?: number;
  /** Number of fresh signals written into ipc_signals on this scan. */
  persisted?: number;
}

export const evaluateIPCServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accessionRowId: string }) =>
    z.object({ accessionRowId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<IPCServerResult> => {
    const { supabase } = context;

    // Load the target accession.
    const { data: target, error: tErr } = await supabase
      .from("accessions")
      .select("id, mrn, data")
      .eq("id", data.accessionRowId)
      .maybeSingle();
    if (tErr) throw new Error(`Load failed: ${tErr.message}`);
    if (!target) return { ok: false, reason: "Accession not found or not visible." };

    const targetAccession = target.data as unknown as Accession;

    // Load every other accession the user can see (RLS scopes to tenant).
    // For rolling-window dedup the engine only needs same-MRN priors, so we
    // narrow to that to keep the payload small.
    const mrn = target.mrn;
    let cohort: Accession[] = [];
    if (mrn) {
      const { data: rows, error: cErr } = await supabase
        .from("accessions")
        .select("data")
        .eq("mrn", mrn);
      if (cErr) throw new Error(`Cohort load failed: ${cErr.message}`);
      cohort = (rows ?? []).map((r) => r.data as unknown as Accession);
    }

    const cohortMap: Record<string, Accession> = {};
    for (const a of cohort) cohortMap[a.id] = a;
    // Make sure the target accession itself is in the map (engine looks it up
    // by id when filtering "other accessions").
    cohortMap[targetAccession.id] = targetAccession;

    const report = evaluateIPC(targetAccession, cohortMap);

    // Persist fresh signals (isNewEpisode === true) into the tenant-wide
    // ipc_signals table so the IPC team has a durable open-episode dashboard.
    // Dedupe is handled both by the engine (rolling window per MRN) and by the
    // table's UNIQUE (accession_id, isolate_id, rule_code) constraint, so the
    // same scan can re-run safely without producing duplicate rows.
    let persisted = 0;
    const fresh = report.decisions.filter((d) => d.isNewEpisode);
    if (fresh.length > 0) {
      // Need tenant_id for the insert — load it via the row id (RLS-safe).
      const { data: tenantRow } = await supabase
        .from("accessions")
        .select("tenant_id")
        .eq("id", data.accessionRowId)
        .maybeSingle();
      const tenantId = tenantRow?.tenant_id as string | undefined;
      if (tenantId) {
        const ward = targetAccession.patient.ward ?? null;
        const mrnVal = targetAccession.patient.mrn ?? null;
        const rows = fresh.map((d) => ({
          tenant_id: tenantId,
          accession_id: data.accessionRowId,
          isolate_id: d.isolateId,
          rule_code: d.ruleCode,
          organism_code: d.organismCode ?? null,
          phenotypes: d.phenotypes as unknown as object,
          message: d.message,
          timing: d.timing,
          actions: d.actions as unknown as object,
          notify: d.notify as unknown as object,
          mrn: mrnVal,
          ward,
          raised_by: context.userId,
        }));
        const { error: insErr, count } = await (supabase.from("ipc_signals") as any).upsert(rows, {
          onConflict: "accession_id,isolate_id,rule_code",
          ignoreDuplicates: true,
          count: "exact",
        });
        if (insErr) {
          // Don't fail the whole scan — surface in reason but still return decisions.
          return {
            ok: true,
            decisions: report.decisions,
            cohortSize: cohort.length,
            persisted: 0,
            reason: `Persist warning: ${insErr.message}`,
          };
        }
        persisted = count ?? 0;
      }
    }

    return {
      ok: true,
      decisions: report.decisions,
      cohortSize: cohort.length,
      persisted,
    };
  });
