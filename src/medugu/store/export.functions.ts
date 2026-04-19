// Server-authoritative outbound export.
//
// dispatchExport: pulls the most recent immutable release_packages row for
// the given accession, regenerates the wire payload server-side using the
// shared exportEngine (FHIR / HL7 / JSON), POSTs it to the receiver's
// endpoint with optional bearer token, and inserts an export_deliveries
// row. The DB trigger writes a release.dispatched audit row.
//
// The browser cannot bypass: the receiver registry is RLS-scoped to the
// caller's tenant, only released/amended accessions resolve a release row,
// and the server is the only place the bearer token is read.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Accession, ReleasePackage } from "../domain/types";
import { ReleaseState } from "../domain/enums";
import { buildExport, type ExportFormat } from "../logic/exportEngine";

export interface DispatchResult {
  ok: boolean;
  reason?: string;
  httpStatus?: number;
  responseSnippet?: string;
  deliveryId?: string;
}

const TRUNC = 4000;

export const dispatchExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accessionRowId: string; receiverId: string }) =>
    z
      .object({
        accessionRowId: z.string().uuid(),
        receiverId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<DispatchResult> => {
    const { supabase, userId } = context;

    // 1. Load receiver (RLS-scoped, must be enabled).
    const { data: receiver, error: rcvErr } = await supabase
      .from("receivers")
      .select("id, tenant_id, name, endpoint_url, format, bearer_token, enabled")
      .eq("id", data.receiverId)
      .maybeSingle();
    if (rcvErr) return { ok: false, reason: `Receiver lookup failed: ${rcvErr.message}` };
    if (!receiver) return { ok: false, reason: "Receiver not found or not visible." };
    if (!receiver.enabled) return { ok: false, reason: "Receiver is disabled." };

    const format = receiver.format as ExportFormat;

    // 2. Load accession (RLS-scoped); must be released or amended.
    const { data: acc, error: accErr } = await supabase
      .from("accessions")
      .select("id, tenant_id, release_state, data")
      .eq("id", data.accessionRowId)
      .maybeSingle();
    if (accErr) return { ok: false, reason: `Accession lookup failed: ${accErr.message}` };
    if (!acc) return { ok: false, reason: "Accession not found or not visible." };
    if (acc.tenant_id !== receiver.tenant_id) {
      return { ok: false, reason: "Receiver and accession belong to different tenants." };
    }
    if (
      acc.release_state !== ReleaseState.Released &&
      acc.release_state !== ReleaseState.Amended
    ) {
      return { ok: false, reason: "Accession has not been released — nothing to dispatch." };
    }

    // 3. Load most recent release package (immutable, append-only).
    const { data: pkgRow, error: pkgErr } = await supabase
      .from("release_packages")
      .select("id, version, body, rule_version, breakpoint_version, export_version, build_version, built_at")
      .eq("accession_id", acc.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pkgErr) return { ok: false, reason: `Release package lookup failed: ${pkgErr.message}` };
    if (!pkgRow) return { ok: false, reason: "No frozen release package found." };

    // 4. Reconstruct accession with frozen package and call shared exportEngine.
    const accession = acc.data as unknown as Accession;
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
    if (!payload.gate.available) {
      return { ok: false, reason: payload.gate.reason ?? "Export gate denied." };
    }

    // 5. POST to the receiver. Network errors and non-2xx are recorded.
    let httpStatus: number | null = null;
    let responseBody: string | null = null;
    let errorMessage: string | null = null;
    try {
      const headers: Record<string, string> = {
        "Content-Type": payload.mime,
        "X-Medugu-Format": format,
        "X-Medugu-Accession": accession.accessionNumber,
        "X-Medugu-Report-Version": String(pkg.version),
      };
      if (receiver.bearer_token) {
        headers["Authorization"] = `Bearer ${receiver.bearer_token}`;
      }
      const ctrl = new AbortController();
      const timeoutId = setTimeout(() => ctrl.abort(), 15_000);
      const res = await fetch(receiver.endpoint_url, {
        method: "POST",
        headers,
        body: payload.content,
        signal: ctrl.signal,
      });
      clearTimeout(timeoutId);
      httpStatus = res.status;
      const text = await res.text();
      responseBody = text.length > TRUNC ? text.slice(0, TRUNC) + "…[truncated]" : text;
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    // 6. Append delivery row (trigger writes audit). Insert even on failure.
    const ok = httpStatus !== null && httpStatus >= 200 && httpStatus < 300;
    const { data: delivery, error: insErr } = await supabase
      .from("export_deliveries")
      .insert({
        tenant_id: receiver.tenant_id,
        accession_id: acc.id,
        release_package_id: pkgRow.id,
        receiver_id: receiver.id,
        format,
        http_status: httpStatus,
        response_body: responseBody,
        error_message: errorMessage,
        dispatched_by: userId,
      } as never)
      .select("id")
      .maybeSingle();
    if (insErr) {
      return { ok: false, reason: `Delivery insert failed: ${insErr.message}` };
    }

    return {
      ok,
      reason: ok ? undefined : errorMessage ?? `Receiver returned HTTP ${httpStatus ?? "n/a"}`,
      httpStatus: httpStatus ?? undefined,
      responseSnippet: responseBody?.slice(0, 240),
      deliveryId: delivery?.id as string | undefined,
    };
  });
