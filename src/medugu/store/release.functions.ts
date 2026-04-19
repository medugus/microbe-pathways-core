// Server-authoritative release sealing.
//
// The browser cannot bypass `releaseAllowed === false`: this server function
// re-runs validation on the persisted accession before it freezes the package.
// It computes a SHA-256 seal over the canonical body, inserts an immutable
// release_packages row, and updates the accessions row to "released".
//
// Returns the frozen ReleasePackage + sealHash so the client can refresh its
// cached copy without trusting any browser-side computation.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Accession, ReleasePackage } from "../domain/types";
import { ReleaseState } from "../domain/enums";
import { runValidation } from "../logic/validationEngine";
import { buildReportPreview } from "../logic/reportPreview";

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface ReleaseSealResult {
  ok: boolean;
  reason?: string;
  blockerCodes?: string[];
  package?: ReleasePackage;
  sealHash?: string;
  reportVersion?: number;
  accession?: Accession;
}

export const sealRelease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accessionRowId: string }) =>
    z.object({ accessionRowId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<ReleaseSealResult> => {
    const { supabase, userId } = context;

    // 1. Load the accession (RLS scopes to caller's tenant).
    const { data: row, error: loadErr } = await supabase
      .from("accessions")
      .select("id, tenant_id, version, release_state, data")
      .eq("id", data.accessionRowId)
      .maybeSingle();
    if (loadErr) throw new Error(`Load failed: ${loadErr.message}`);
    if (!row) return { ok: false, reason: "Accession not found or not visible." };
    if (row.release_state === ReleaseState.Released) {
      return { ok: false, reason: "Already released — use amendment flow." };
    }

    const accession = row.data as Accession;

    // 2. Server-authoritative validation. Client cannot bypass this.
    const v = runValidation(accession);
    if (!v.releaseAllowed) {
      return {
        ok: false,
        reason: `Release blocked by ${v.blockers.length} blocker(s).`,
        blockerCodes: v.blockers.map((b) => b.code),
      };
    }

    // 3. Build the frozen body (deep clone via JSON.stringify roundtrip below).
    const preview = buildReportPreview(accession);
    const nextVersion = (accession.release.reportVersion ?? 0) + 1;
    const builtAt = new Date().toISOString();
    const canonicalBody = JSON.stringify(preview);
    const sealHash = await sha256Hex(canonicalBody);

    const pkg: ReleasePackage = {
      builtAt,
      version: nextVersion,
      body: JSON.parse(canonicalBody),
      ruleVersion: accession.ruleVersion,
      breakpointVersion: accession.breakpointVersion,
      exportVersion: accession.exportVersion,
      buildVersion: accession.buildVersion,
    };

    // 4. Append-only insert into release_packages. Trigger writes audit.
    const { error: insErr } = await supabase.from("release_packages").insert({
      tenant_id: row.tenant_id,
      accession_id: row.id,
      version: nextVersion,
      built_at: builtAt,
      built_by: userId,
      body: pkg.body as never,
      rule_version: { value: pkg.ruleVersion } as never,
      breakpoint_version: pkg.breakpointVersion,
      export_version: pkg.exportVersion,
      build_version: pkg.buildVersion,
      body_sha256: sealHash,
    } as never);
    if (insErr) {
      // 23505 = duplicate version — treat as race; refuse rather than overwrite.
      return { ok: false, reason: `Seal insert failed: ${insErr.message}` };
    }

    // 5. Update the accession to released, embedding the sealed package.
    const releasedAccession: Accession = {
      ...accession,
      releasePackage: pkg,
      release: {
        ...accession.release,
        state: ReleaseState.Released,
        releasedAt: builtAt,
        releasedBy: userId,
        reportVersion: nextVersion,
        sealHash,
      },
      releasedAt: builtAt,
      releasingActor: userId,
      updatedAt: builtAt,
    };

    const { error: updErr } = await supabase
      .from("accessions")
      .update({
        stage: releasedAccession.workflowStatus,
        release_state: ReleaseState.Released,
        report_version: nextVersion,
        data: releasedAccession as never,
        version: row.version + 1,
        updated_by: userId,
      } as never)
      .eq("id", row.id)
      .eq("version", row.version);
    if (updErr) return { ok: false, reason: `Update failed: ${updErr.message}` };

    return {
      ok: true,
      package: pkg,
      sealHash,
      reportVersion: nextVersion,
      accession: releasedAccession,
    };
  });
