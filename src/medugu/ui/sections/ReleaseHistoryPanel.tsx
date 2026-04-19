// ReleaseHistoryPanel — lists every immutable release_packages row for the
// active accession (v1, v2, …) with builtAt, builtBy display name, sealHash,
// and the amendmentReason joined from the matching audit_event row
// (action='release.amended', entity_id='<accessionId>:<version>').
//
// Pure read-only — RLS already scopes everything to the tenant.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PackageRow {
  id: string;
  version: number;
  built_at: string;
  built_by: string | null;
  body_sha256: string;
  build_version: string;
  breakpoint_version: string;
  export_version: string;
}

interface HistoryEntry extends PackageRow {
  builtByName: string | null;
  amendmentReason: string | null;
}

interface Props {
  accessionRowId: string;
}

export function ReleaseHistoryPanel({ accessionRowId }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        // 1. Every release package for this accession, newest first.
        const { data: pkgs, error: pkgErr } = await supabase
          .from("release_packages")
          .select(
            "id, version, built_at, built_by, body_sha256, build_version, breakpoint_version, export_version",
          )
          .eq("accession_id", accessionRowId)
          .order("version", { ascending: false });
        if (pkgErr) throw new Error(pkgErr.message);
        const packages = (pkgs ?? []) as PackageRow[];

        if (packages.length === 0) {
          if (!cancelled) setEntries([]);
          return;
        }

        // 2. Resolve builtBy UUIDs → display names (best effort, RLS may hide).
        const userIds = Array.from(
          new Set(packages.map((p) => p.built_by).filter((x): x is string => !!x)),
        );
        const nameById = new Map<string, string>();
        if (userIds.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, display_name, email")
            .in("id", userIds);
          for (const p of profs ?? []) {
            nameById.set(
              p.id as string,
              (p.display_name as string | null) ?? (p.email as string | null) ?? "—",
            );
          }
        }

        // 3. Pull amendment reasons from audit_event for this accession.
        // The release.amended trigger writes entity_id = '<accessionId>:<version>'
        // and stores the reason in the `reason` column.
        const versionEntityIds = packages.map(
          (p) => `${accessionRowId}:${p.version}`,
        );
        const reasonByVersion = new Map<number, string>();
        if (versionEntityIds.length > 0) {
          const { data: audits } = await supabase
            .from("audit_event")
            .select("entity_id, action, reason")
            .eq("entity", "release_package")
            .eq("action", "release.amended")
            .in("entity_id", versionEntityIds);
          for (const a of audits ?? []) {
            const eid = a.entity_id as string | null;
            if (!eid) continue;
            const v = Number(eid.split(":")[1]);
            if (Number.isFinite(v) && a.reason) {
              reasonByVersion.set(v, a.reason as string);
            }
          }
        }

        const merged: HistoryEntry[] = packages.map((p) => ({
          ...p,
          builtByName: p.built_by ? (nameById.get(p.built_by) ?? null) : null,
          amendmentReason: reasonByVersion.get(p.version) ?? null,
        }));

        if (!cancelled) setEntries(merged);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [accessionRowId]);

  return (
    <section>
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Release history
      </h4>
      {loading && (
        <p className="text-[11px] text-muted-foreground">Loading history…</p>
      )}
      {error && (
        <p className="text-[11px] text-destructive">History failed: {error}</p>
      )}
      {!loading && !error && entries && entries.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          No release packages yet.
        </p>
      )}
      {!loading && !error && entries && entries.length > 0 && (
        <ol className="space-y-2">
          {entries.map((e) => (
            <li
              key={e.id}
              className="rounded-md border border-border bg-card p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary">
                    v{e.version}
                  </span>
                  {e.amendmentReason && (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
                      amended
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(e.built_at).toLocaleString()}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  by {e.builtByName ?? "—"}
                </span>
              </div>
              <div className="mt-1.5 break-all font-mono text-[10px] text-muted-foreground">
                seal: {e.body_sha256}
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                <span>build {e.build_version}</span>
                <span>· breakpoint {e.breakpoint_version}</span>
                <span>· export {e.export_version}</span>
              </div>
              {e.amendmentReason && (
                <p className="mt-2 rounded bg-muted/50 p-2 text-[11px] text-foreground">
                  <span className="text-muted-foreground">Reason: </span>
                  <span className="italic">{e.amendmentReason}</span>
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
