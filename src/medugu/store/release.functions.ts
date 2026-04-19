// Server-authoritative release sealing + amendment.
//
// Two server functions:
//   - sealRelease: first release. Re-runs validation, inserts immutable
//     release_packages row v1+, sets release_state=released.
//   - amendRelease: post-release correction. Requires amendmentReason,
//     re-runs validation, inserts a NEW release_packages row at version+1
//     (the previous row is immutable and remains as the historical record),
//     sets release_state=amended. Audit row written by DB trigger.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Accession, ReleasePackage } from "../domain/types";
import { ReleaseState } from "../domain/enums";
import { runValidation } from "../logic/validationEngine";
import { buildReportPreview } from "../logic/reportPreview";
import { autoDispatchRelease, type AutoDispatchResult } from "./export.functions";

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
  sealHash?: string;
  reportVersion?: number;
  builtAt?: string;
  /** Serialized Accession — client treats as `Accession`. */
  accessionJson?: string;
  /** Per-receiver auto-dispatch outcome (one entry per enabled receiver). */
  autoDispatch?: AutoDispatchResult[];
}

export const sealRelease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accessionRowId: string }) =>
    z.object({ accessionRowId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<ReleaseSealResult> => {
    const { supabase, userId } = context;

    const { data: row, error: loadErr } = await supabase
      .from("accessions")
      .select("id, tenant_id, version, release_state, data")
      .eq("id", data.accessionRowId)
      .maybeSingle();
    if (loadErr) throw new Error(`Load failed: ${loadErr.message}`);
    if (!row) return { ok: false, reason: "Accession not found or not visible." };
    if (row.release_state === ReleaseState.Released || row.release_state === ReleaseState.Amended) {
      return { ok: false, reason: "Already released — use amendment flow." };
    }

    const accession = row.data as unknown as Accession;

    const v = runValidation(accession);
    if (!v.releaseAllowed) {
      return {
        ok: false,
        reason: `Release blocked by ${v.blockers.length} blocker(s).`,
        blockerCodes: v.blockers.map((b) => b.code),
      };
    }

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

    const { data: insertedPkg, error: insErr } = await supabase
      .from("release_packages")
      .insert({
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
      } as never)
      .select("id, version, body, rule_version, breakpoint_version, export_version, build_version, built_at")
      .maybeSingle();
    if (insErr || !insertedPkg) {
      return { ok: false, reason: `Seal insert failed: ${insErr?.message ?? "no row returned"}` };
    }

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

    // Auto-dispatch to every enabled receiver. Failures are reported
    // per-receiver and do NOT roll back the seal.
    const autoDispatch = await autoDispatchRelease(
      supabase,
      userId,
      row.tenant_id as string,
      releasedAccession,
      row.id as string,
      insertedPkg as never,
    );

    return {
      ok: true,
      sealHash,
      reportVersion: nextVersion,
      builtAt,
      accessionJson: JSON.stringify(releasedAccession),
      autoDispatch,
    };
  });

/**
 * amendRelease — post-release correction.
 *
 * Pre-conditions: accession.release.state ∈ {released, amended} and validation
 * still passes against the (possibly edited) accession body. Requires a
 * non-empty amendmentReason for non-repudiation.
 *
 * Effect: inserts a NEW release_packages row at v+1 (the prior row stays
 * immutable as the historical version), bumps report_version on the
 * accession, sets release_state=amended, and writes a release.amended
 * audit row directly (so the DB trigger's release.frozen + this explicit
 * release.amended together form the amendment trail).
 */
export const amendRelease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accessionRowId: string; amendmentReason: string }) =>
    z
      .object({
        accessionRowId: z.string().uuid(),
        amendmentReason: z.string().min(4).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ReleaseSealResult> => {
    const { supabase, userId } = context;

    const { data: row, error: loadErr } = await supabase
      .from("accessions")
      .select("id, tenant_id, version, release_state, data, report_version")
      .eq("id", data.accessionRowId)
      .maybeSingle();
    if (loadErr) throw new Error(`Load failed: ${loadErr.message}`);
    if (!row) return { ok: false, reason: "Accession not found or not visible." };
    if (
      row.release_state !== ReleaseState.Released &&
      row.release_state !== ReleaseState.Amended
    ) {
      return { ok: false, reason: "Cannot amend — accession has not been released." };
    }

    const accession = row.data as unknown as Accession;

    // Re-run validation: an amendment must still pass the same gates.
    const v = runValidation(accession);
    if (!v.releaseAllowed) {
      return {
        ok: false,
        reason: `Amendment blocked by ${v.blockers.length} blocker(s).`,
        blockerCodes: v.blockers.map((b) => b.code),
      };
    }

    const preview = buildReportPreview(accession);
    const nextVersion = (row.report_version ?? accession.release.reportVersion ?? 1) + 1;
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

    const { data: insertedPkg, error: insErr } = await supabase
      .from("release_packages")
      .insert({
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
      } as never)
      .select("id, version, body, rule_version, breakpoint_version, export_version, build_version, built_at")
      .maybeSingle();
    if (insErr || !insertedPkg) {
      return { ok: false, reason: `Amendment insert failed: ${insErr?.message ?? "no row returned"}` };
    }

    const amendedAccession: Accession = {
      ...accession,
      releasePackage: pkg,
      release: {
        ...accession.release,
        state: ReleaseState.Amended,
        releasedAt: builtAt,
        releasedBy: userId,
        reportVersion: nextVersion,
        sealHash,
        amendmentReason: data.amendmentReason,
      },
      releasedAt: builtAt,
      releasingActor: userId,
      updatedAt: builtAt,
    };

    const { error: updErr } = await supabase
      .from("accessions")
      .update({
        stage: amendedAccession.workflowStatus,
        release_state: ReleaseState.Amended,
        report_version: nextVersion,
        data: amendedAccession as never,
        version: row.version + 1,
        updated_by: userId,
      } as never)
      .eq("id", row.id)
      .eq("version", row.version);
    if (updErr) return { ok: false, reason: `Update failed: ${updErr.message}` };

    // Explicit amendment audit (in addition to the release.frozen trigger row).
    await supabase.from("audit_event").insert({
      tenant_id: row.tenant_id,
      actor_user_id: userId,
      action: "release.amended",
      entity: "release_package",
      entity_id: `${row.id}:${nextVersion}`,
      reason: data.amendmentReason,
      new_value: {
        version: nextVersion,
        body_sha256: sealHash,
        supersedes_version: nextVersion - 1,
      } as never,
    } as never);

    return {
      ok: true,
      sealHash,
      reportVersion: nextVersion,
      builtAt,
      accessionJson: JSON.stringify(amendedAccession),
    };
  });
