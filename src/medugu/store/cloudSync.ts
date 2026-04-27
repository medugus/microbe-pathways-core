// Cloud sync adapter for the accession store.
//
// Design:
//  - Postgres is the source of truth (multi-tenant, RLS-enforced).
//  - The in-memory accessionStore remains the working copy that all engines
//    read/write — engines stay framework-agnostic.
//  - This adapter is the ONLY thing that talks to Supabase from the store path.
//
// On hydration:
//  - Load every accession row visible to the current user (RLS scopes by tenant).
//  - If the tenant is empty, seed it with the six benchmark demo accessions
//    so a brand-new lab sees the same starting state as the browser-phase build.
//
// On mutation:
//  - Each upserted Accession is pushed back to Postgres (debounced per-id).
//  - Released accessions also append a new row to release_packages once.
//
// All cross-tenant isolation is enforced by RLS — this file does not filter
// on tenant_id beyond what RLS already rejects.

import { supabase } from "@/integrations/supabase/client";
import type { Accession, ReleasePackage } from "../domain/types";
import { DEMO_ACCESSIONS } from "../seed/demoAccessions";

// ---------- helpers ----------

async function sha256Hex(input: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Fallback (should not run in modern browsers) — degrade to a marker.
  return "no-subtle-crypto";
}

function rowToAccession(row: { data: unknown }): Accession {
  return row.data as Accession;
}

// ---------- API ----------

export interface HydrationResult {
  accessions: Accession[];
  tenantId: string;
}

/**
 * Load every accession the current user can see.
 * If empty, seeds the lab with the demo benchmark scenarios.
 */
export async function hydrateFromCloud(tenantId: string): Promise<HydrationResult> {
  const { data, error } = await supabase
    .from("accessions")
    .select("data, updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as Array<{ data: unknown }>;
  if (rows.length === 0) {
    // Empty tenant — seed it with the demo cases.
    await seedTenantWithDemo(tenantId);
    const { data: seeded, error: seedErr } = await supabase
      .from("accessions")
      .select("data, updated_at")
      .order("updated_at", { ascending: false });
    if (seedErr) throw seedErr;
    return {
      tenantId,
      accessions: ((seeded ?? []) as Array<{ data: unknown }>).map(rowToAccession),
    };
  }

  return { tenantId, accessions: rows.map(rowToAccession) };
}

async function seedTenantWithDemo(tenantId: string): Promise<void> {
  const userRes = await supabase.auth.getUser();
  const userId = userRes.data.user?.id;
  const rows = DEMO_ACCESSIONS.map((a) => ({
    tenant_id: tenantId,
    accession_code: a.accessionNumber,
    mrn: a.patient.mrn,
    patient_name: `${a.patient.givenName} ${a.patient.familyName}`.trim(),
    stage: a.workflowStatus,
    release_state: a.release.state,
    report_version: a.release.reportVersion ?? 0,
    data: a as unknown as never,
    version: 1,
    created_by: userId ?? null,
    updated_by: userId ?? null,
  }));
  const { error } = await supabase.from("accessions").insert(rows as never);
  if (error && error.code !== "23505") {
    // 23505 = unique_violation — another session seeded first; safe to ignore.
    throw error;
  }
}

/**
 * Upsert one accession back to Postgres. Bumps the optimistic concurrency
 * `version` column.
 */
export async function pushAccession(tenantId: string, a: Accession): Promise<void> {
  const userRes = await supabase.auth.getUser();
  const userId = userRes.data.user?.id;

  // Try update first (most common path).
  const { data: existing } = await supabase
    .from("accessions")
    .select("id, version")
    .eq("tenant_id", tenantId)
    .eq("accession_code", a.accessionNumber)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("accessions")
      .update({
        mrn: a.patient.mrn,
        patient_name: `${a.patient.givenName} ${a.patient.familyName}`.trim(),
        stage: a.workflowStatus,
        release_state: a.release.state,
        report_version: a.release.reportVersion ?? 0,
        data: a as unknown as never,
        version: (existing.version as number) + 1,
        updated_by: userId ?? null,
      } as never)
      .eq("id", existing.id as string)
      .eq("version", existing.version as number);
    if (error) throw error;

    if (a.releasePackage) {
      await maybePushReleasePackage(tenantId, existing.id as string, a.releasePackage);
    }
    return;
  }

  // Insert path.
  const { data: inserted, error } = await supabase
    .from("accessions")
    .insert({
      tenant_id: tenantId,
      accession_code: a.accessionNumber,
      mrn: a.patient.mrn,
      patient_name: `${a.patient.givenName} ${a.patient.familyName}`.trim(),
      stage: a.workflowStatus,
      release_state: a.release.state,
      report_version: a.release.reportVersion ?? 0,
      data: a as unknown as never,
      version: 1,
      created_by: userId ?? null,
      updated_by: userId ?? null,
    } as never)
    .select("id")
    .single();
  if (error) throw error;

  if (a.releasePackage && inserted) {
    await maybePushReleasePackage(tenantId, inserted.id as string, a.releasePackage);
  }
}

async function maybePushReleasePackage(
  tenantId: string,
  accessionRowId: string,
  pkg: ReleasePackage,
): Promise<void> {
  // Append-only: skip if this version already exists.
  const { data: existing } = await supabase
    .from("release_packages")
    .select("id")
    .eq("accession_id", accessionRowId)
    .eq("version", pkg.version)
    .maybeSingle();
  if (existing) return;

  const userRes = await supabase.auth.getUser();
  const userId = userRes.data.user?.id;
  const canonicalBody = JSON.stringify(pkg.body);
  const hash = await sha256Hex(canonicalBody);

  const { error } = await supabase.from("release_packages").insert({
    tenant_id: tenantId,
    accession_id: accessionRowId,
    version: pkg.version,
    built_at: pkg.builtAt,
    built_by: userId ?? null,
    body: pkg.body as unknown as never,
    rule_version: { value: pkg.ruleVersion } as unknown as never,
    breakpoint_version: pkg.breakpointVersion,
    export_version: pkg.exportVersion,
    build_version: pkg.buildVersion,
    body_sha256: hash,
  } as never);
  if (error && error.code !== "23505") throw error;
}
