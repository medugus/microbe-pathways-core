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
//
// dispatchToReceiver (internal helper) is the same flow exposed for the
// auto-dispatch on release/amend pipeline (see release.functions.ts), so
// every dispatch path goes through one tested implementation.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Accession } from "../domain/types";
import { ReleaseState } from "../domain/enums";
import type { ExportFormat } from "../logic/exportEngine";

export interface DispatchResult {
  ok: boolean;
  reason?: string;
  httpStatus?: number;
  responseSnippet?: string;
  deliveryId?: string;
}

/** Per-receiver result shape used in auto-dispatch summaries. */
export interface AutoDispatchResult {
  receiverId: string;
  receiverName: string;
  format: ExportFormat;
  ok: boolean;
  httpStatus?: number;
  reason?: string;
  deliveryId?: string;
}

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
    const { dispatchToReceiver, getSupabaseAdmin } = await import("./export.server");
    const supabaseAdmin = getSupabaseAdmin();


    // 1. Verify receiver visibility under the caller's tenant via RLS-scoped client.
    const { data: visibleRcv, error: visErr } = await supabase
      .from("receivers")
      .select("id, tenant_id, enabled")
      .eq("id", data.receiverId)
      .maybeSingle();
    if (visErr) return { ok: false, reason: `Receiver lookup failed: ${visErr.message}` };
    if (!visibleRcv) return { ok: false, reason: "Receiver not found or not visible." };
    if (!visibleRcv.enabled) return { ok: false, reason: "Receiver is disabled." };
    // Load bearer_token server-side (column-revoked from authenticated).
    const { data: receiver, error: rcvErr } = await supabaseAdmin
      .from("receivers")
      .select("id, tenant_id, name, endpoint_url, format, bearer_token, enabled")
      .eq("id", data.receiverId)
      .eq("tenant_id", visibleRcv.tenant_id)
      .maybeSingle();
    if (rcvErr) return { ok: false, reason: `Receiver lookup failed: ${rcvErr.message}` };
    if (!receiver) return { ok: false, reason: "Receiver not found." };

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

    return dispatchToReceiver(
      supabase,
      userId,
      receiver as unknown as ReceiverRow,
      acc.data as unknown as Accession,
      acc.id as string,
      pkgRow as unknown as PackageRow,
    );
  });
