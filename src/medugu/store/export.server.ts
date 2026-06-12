// Server-only export delivery implementation.
//
// This module owns service-role access and outbound receiver dispatch. It must
// only be loaded from createServerFn handlers.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Accession, ReleasePackage } from "../domain/types";
import { buildExport, type ExportFormat } from "../logic/exportEngine";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AutoDispatchResult, DispatchResult } from "./export.functions";

export function getSupabaseAdmin() {
  return supabaseAdmin;
}

const TRUNC = 4000;

interface ReceiverRow {
  id: string;
  tenant_id: string;
  name: string;
  endpoint_url: string;
  format: string;
  bearer_token: string | null;
  enabled: boolean;
}

interface PackageRow {
  id: string;
  version: number;
  body: unknown;
  rule_version: unknown;
  breakpoint_version: string;
  export_version: string;
  build_version: string;
  built_at: string;
}

/**
 * Internal: POST a single release package payload to one receiver and record
 * the export_deliveries row. Used by both the user-triggered dispatchExport
 * server function and the auto-dispatch path inside sealRelease/amendRelease.
 */
export async function dispatchToReceiver(
  supabase: SupabaseClient,
  userId: string,
  receiver: ReceiverRow,
  accession: Accession,
  accessionRowId: string,
  pkgRow: PackageRow,
): Promise<DispatchResult> {
  const format = receiver.format as ExportFormat;

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

  const ok = httpStatus !== null && httpStatus >= 200 && httpStatus < 300;
  const { data: delivery, error: insErr } = await supabase
    .from("export_deliveries")
    .insert({
      tenant_id: receiver.tenant_id,
      accession_id: accessionRowId,
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
}

/**
 * Auto-dispatch a freshly sealed (or amended) release to every enabled
 * receiver in the tenant. Failures of individual receivers do NOT roll back
 * the release — each result is reported independently so the UI can surface
 * partial success.
 */
export async function autoDispatchRelease(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string,
  accession: Accession,
  accessionRowId: string,
  pkgRow: PackageRow,
  excludedReceiverIds: string[] = [],
): Promise<AutoDispatchResult[]> {
  // Verify visibility via the caller's RLS-scoped client (tenant membership)…
  const { data: visible, error: visErr } = await supabase
    .from("receivers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("enabled", true);
  if (visErr || !visible || visible.length === 0) return [];
  const visibleIds = visible.map((r) => r.id as string);
  // …then load bearer_token server-side via the admin client (column-revoked from authenticated).
  const { data: receivers, error } = await supabaseAdmin
    .from("receivers")
    .select("id, tenant_id, name, endpoint_url, format, bearer_token, enabled")
    .eq("tenant_id", tenantId)
    .eq("enabled", true)
    .in("id", visibleIds);
  if (error || !receivers || receivers.length === 0) return [];

  const excluded = new Set(excludedReceiverIds);
  const results: AutoDispatchResult[] = [];
  for (const r of receivers as unknown as ReceiverRow[]) {
    if (excluded.has(r.id)) {
      results.push({
        receiverId: r.id,
        receiverName: r.name,
        format: r.format as ExportFormat,
        ok: true,
        reason: "Skipped — auto-dispatch disabled for this receiver.",
      });
      continue;
    }
    const out = await dispatchToReceiver(
      supabase,
      userId,
      r,
      accession,
      accessionRowId,
      pkgRow,
    );
    results.push({
      receiverId: r.id,
      receiverName: r.name,
      format: r.format as ExportFormat,
      ok: out.ok,
      httpStatus: out.httpStatus,
      reason: out.reason,
      deliveryId: out.deliveryId,
    });
  }
  return results;
}
