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

    const nextAst = accession.ast.map((r) =>
      merged[r.id] ? { ...r, ...merged[r.id] } : r,
    );
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

    return {
      ok: true,
      decisions: report.decisions,
      cohortSize: cohort.length,
    };
  });
