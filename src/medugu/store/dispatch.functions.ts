// Browser-phase dispatch simulation + retry.
//
// SCOPE: This module is intentionally a MOCK transport. No payload ever
// leaves the browser/server boundary — we do NOT POST to any external
// receiver. Its purpose is to model the dispatch lifecycle so the UI's
// retry-on-failure flow can be exercised end-to-end inside Lovable.
//
// Source-of-truth invariants (must NOT change in this file):
//  - Payloads are regenerated from the immutable release_packages row only.
//    We never read live accession state for dispatch content.
//  - Hashes / seal verification are not touched here.
//  - Each row write goes through dispatch_history; the audit trigger
//    materialises dispatch.requested / .sent / .failed / .retried events.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Accession, ReleasePackage } from "../domain/types";
import { buildExport, type ExportFormat } from "../logic/exportEngine";

export type DispatchStatus = "queued" | "sent" | "failed" | "cancelled";

export interface DispatchHistoryRow {
  id: string;
  release_package_id: string;
  release_version: number;
  receiver_name: string;
  format: ExportFormat;
  status: DispatchStatus;
  attempt_no: number;
  parent_dispatch_id: string | null;
  error_message: string | null;
  simulated_failure: boolean;
  payload_bytes: number | null;
  requested_at: string;
  completed_at: string | null;
}

export interface DispatchSimResult {
  ok: boolean;
  reason?: string;
  row?: DispatchHistoryRow;
}

const FORMATS: ExportFormat[] = ["fhir", "hl7", "json"];

const SIMULATED_ERRORS = [
  "Simulated: receiver returned HTTP 503 (service unavailable).",
  "Simulated: TLS handshake timeout after 15s.",
  "Simulated: receiver rejected payload (HTTP 422 schema violation).",
  "Simulated: connection reset by peer.",
];

function pickError(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return SIMULATED_ERRORS[Math.abs(h) % SIMULATED_ERRORS.length];
}

/**
 * Build the wire payload for a release package, server-side, from the FROZEN
 * release_packages.body — never from live accession state.
 */
function buildPayloadFromFrozenPackage(
  accession: Accession,
  pkgRow: {
    version: number;
    body: unknown;
    rule_version: unknown;
    breakpoint_version: string;
    export_version: string;
    build_version: string;
    built_at: string;
  },
  format: ExportFormat,
): { content: string; bytes: number } | { error: string } {
  const ruleVersion =
    typeof pkgRow.rule_version === "object" && pkgRow.rule_version
      ? ((pkgRow.rule_version as { value?: string }).value ?? accession.ruleVersion)
      : accession.ruleVersion;

  const pkg: ReleasePackage = {
    builtAt: pkgRow.built_at,
    version: pkgRow.version,
    body: pkgRow.body,
    ruleVersion,
    breakpointVersion: pkgRow.breakpoint_version,
    exportVersion: pkgRow.export_version,
    buildVersion: pkgRow.build_version,
  };
  const accForExport: Accession = { ...accession, releasePackage: pkg };
  const payload = buildExport(accForExport, format);
  if (!payload.gate.available) return { error: payload.gate.reason ?? "Export gate denied." };
  return { content: payload.content, bytes: new TextEncoder().encode(payload.content).length };
}

const simulateInput = z.object({
  releasePackageId: z.string().uuid(),
  format: z.enum(["fhir", "hl7", "json"]),
  receiverName: z.string().min(1).max(120).default("mock-receiver"),
  /** When true, force a failed outcome. When false, force success. When omitted, random. */
  forceFail: z.boolean().optional(),
});

/**
 * simulateDispatch — create a fresh attempt #1 against a release package.
 * Inserts a `queued` row, then immediately transitions it to `sent`/`failed`
 * (audit trigger fires both insert and status-change events).
 */
export const simulateDispatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof simulateInput>) => simulateInput.parse(input))
  .handler(async ({ data, context }): Promise<DispatchSimResult> => {
    const { supabase, userId } = context;

    const { data: pkgRow, error: pkgErr } = await supabase
      .from("release_packages")
      .select(
        "id, accession_id, tenant_id, version, body, rule_version, breakpoint_version, export_version, build_version, built_at",
      )
      .eq("id", data.releasePackageId)
      .maybeSingle();
    if (pkgErr) return { ok: false, reason: `Release package lookup failed: ${pkgErr.message}` };
    if (!pkgRow) return { ok: false, reason: "Release package not found or not visible." };

    const { data: accRow, error: accErr } = await supabase
      .from("accessions")
      .select("id, data")
      .eq("id", pkgRow.accession_id as string)
      .maybeSingle();
    if (accErr || !accRow) {
      return { ok: false, reason: `Accession lookup failed: ${accErr?.message ?? "missing"}` };
    }

    const built = buildPayloadFromFrozenPackage(
      accRow.data as unknown as Accession,
      pkgRow as never,
      data.format,
    );
    if ("error" in built) return { ok: false, reason: built.error };

    return runAttempt(supabase, {
      tenantId: pkgRow.tenant_id as string,
      accessionRowId: accRow.id as string,
      releasePackageId: pkgRow.id as string,
      releaseVersion: pkgRow.version as number,
      receiverName: data.receiverName,
      format: data.format,
      attemptNo: 1,
      parentDispatchId: null,
      forceFail: data.forceFail,
      payloadBytes: built.bytes,
      userId,
    });
  });

const retryInput = z.object({
  dispatchId: z.string().uuid(),
  /** When true, force success on retry. When false/omitted, random or fail. */
  forceSuccess: z.boolean().optional(),
});

/**
 * retryDispatch — re-issue a previously failed attempt as attempt N+1 with a
 * parent_dispatch_id link. Only failed rows can be retried.
 */
export const retryDispatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof retryInput>) => retryInput.parse(input))
  .handler(async ({ data, context }): Promise<DispatchSimResult> => {
    const { supabase, userId } = context;

    const { data: original, error: lookupErr } = await supabase
      .from("dispatch_history")
      .select(
        "id, tenant_id, accession_id, release_package_id, release_version, receiver_name, format, status, attempt_no",
      )
      .eq("id", data.dispatchId)
      .maybeSingle();
    if (lookupErr) return { ok: false, reason: `Lookup failed: ${lookupErr.message}` };
    if (!original) return { ok: false, reason: "Original dispatch not found or not visible." };
    if (original.status !== "failed") {
      return { ok: false, reason: `Cannot retry — original status is "${original.status}".` };
    }

    // Walk the chain to compute next attempt number (count attempts sharing the
    // same release_package_id + receiver_name — the retry chain).
    const { data: chain } = await supabase
      .from("dispatch_history")
      .select("attempt_no")
      .eq("release_package_id", original.release_package_id as string)
      .eq("receiver_name", original.receiver_name as string);
    const maxAttempt = (chain ?? []).reduce(
      (m, r) => Math.max(m, (r.attempt_no as number) ?? 1),
      0,
    );

    const { data: pkgRow, error: pkgErr } = await supabase
      .from("release_packages")
      .select(
        "id, version, body, rule_version, breakpoint_version, export_version, build_version, built_at",
      )
      .eq("id", original.release_package_id as string)
      .maybeSingle();
    if (pkgErr || !pkgRow) {
      return {
        ok: false,
        reason: `Release package lookup failed: ${pkgErr?.message ?? "missing"}`,
      };
    }
    const { data: accRow, error: accErr } = await supabase
      .from("accessions")
      .select("id, data")
      .eq("id", original.accession_id as string)
      .maybeSingle();
    if (accErr || !accRow) {
      return { ok: false, reason: `Accession lookup failed: ${accErr?.message ?? "missing"}` };
    }

    const fmt = original.format as ExportFormat;
    if (!FORMATS.includes(fmt)) {
      return { ok: false, reason: `Unknown format: ${original.format}` };
    }
    const built = buildPayloadFromFrozenPackage(
      accRow.data as unknown as Accession,
      pkgRow as never,
      fmt,
    );
    if ("error" in built) return { ok: false, reason: built.error };

    return runAttempt(supabase, {
      tenantId: original.tenant_id as string,
      accessionRowId: original.accession_id as string,
      releasePackageId: original.release_package_id as string,
      releaseVersion: original.release_version as number,
      receiverName: original.receiver_name as string,
      format: fmt,
      attemptNo: maxAttempt + 1,
      parentDispatchId: original.id as string,
      forceFail: data.forceSuccess === true ? false : undefined,
      payloadBytes: built.bytes,
      userId,
    });
  });

interface AttemptArgs {
  tenantId: string;
  accessionRowId: string;
  releasePackageId: string;
  releaseVersion: number;
  receiverName: string;
  format: ExportFormat;
  attemptNo: number;
  parentDispatchId: string | null;
  forceFail?: boolean;
  payloadBytes: number;
  userId: string;
}

async function runAttempt(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  a: AttemptArgs,
): Promise<DispatchSimResult> {
  // 1. Insert as queued (audit: dispatch.requested OR dispatch.retried).
  const { data: inserted, error: insErr } = await supabase
    .from("dispatch_history")
    .insert({
      tenant_id: a.tenantId,
      accession_id: a.accessionRowId,
      release_package_id: a.releasePackageId,
      release_version: a.releaseVersion,
      receiver_name: a.receiverName,
      format: a.format,
      status: "queued",
      attempt_no: a.attemptNo,
      parent_dispatch_id: a.parentDispatchId,
      simulated_failure: false,
      payload_bytes: a.payloadBytes,
      requested_by: a.userId,
    } as never)
    .select(
      "id, release_package_id, release_version, receiver_name, format, status, attempt_no, parent_dispatch_id, error_message, simulated_failure, payload_bytes, requested_at, completed_at",
    )
    .maybeSingle();
  if (insErr || !inserted) {
    return { ok: false, reason: `Insert failed: ${insErr?.message ?? "no row"}` };
  }

  // 2. Decide outcome.
  const fail = a.forceFail === true ? true : a.forceFail === false ? false : Math.random() < 0.5; // 50/50 when unspecified

  const completedAt = new Date().toISOString();
  const errorMessage = fail ? pickError(inserted.id as string) : null;

  // 3. Transition (audit: dispatch.sent OR dispatch.failed).
  const { data: updated, error: updErr } = await supabase
    .from("dispatch_history")
    .update({
      status: fail ? "failed" : "sent",
      simulated_failure: fail,
      error_message: errorMessage,
      completed_at: completedAt,
    } as never)
    .eq("id", inserted.id as string)
    .select(
      "id, release_package_id, release_version, receiver_name, format, status, attempt_no, parent_dispatch_id, error_message, simulated_failure, payload_bytes, requested_at, completed_at",
    )
    .maybeSingle();
  if (updErr || !updated) {
    return { ok: false, reason: `Status update failed: ${updErr?.message ?? "no row"}` };
  }

  return { ok: !fail, row: updated as unknown as DispatchHistoryRow };
}
