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

interface DeliveryRow {
  id: string;
  release_package_id: string;
  receiver_id: string;
  format: string;
  http_status: number | null;
  error_message: string | null;
  dispatched_at: string;
}

interface DeliveryEntry extends DeliveryRow {
  receiverName: string;
}

interface HistoryEntry extends PackageRow {
  builtByName: string | null;
  amendmentReason: string | null;
  deliveries: DeliveryEntry[];
}

interface Props {
  accessionRowId: string;
}

type VerifyState =
  | { status: "idle" }
  | { status: "verifying" }
  | { status: "ok"; recomputed: string }
  | { status: "mismatch"; recomputed: string }
  | { status: "error"; message: string };

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function ReleaseHistoryPanel({ accessionRowId }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [verify, setVerify] = useState<Record<string, VerifyState>>({});

  async function verifySeal(pkgId: string, expectedSha: string) {
    setVerify((m) => ({ ...m, [pkgId]: { status: "verifying" } }));
    try {
      const { data, error: fetchErr } = await supabase
        .from("release_packages")
        .select("body")
        .eq("id", pkgId)
        .maybeSingle();
      if (fetchErr) throw new Error(fetchErr.message);
      if (!data) throw new Error("Release package not visible.");
      // Canonical form must match how sealRelease/amendRelease produced it:
      // JSON.stringify(preview) with no spacing.
      const recomputed = await sha256Hex(JSON.stringify(data.body));
      setVerify((m) => ({
        ...m,
        [pkgId]:
          recomputed === expectedSha
            ? { status: "ok", recomputed }
            : { status: "mismatch", recomputed },
      }));
    } catch (err) {
      setVerify((m) => ({
        ...m,
        [pkgId]: { status: "error", message: err instanceof Error ? err.message : String(err) },
      }));
    }
  }

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

        // 4. Pull export_deliveries for these release packages and join the
        // receiver name so each row can show the dispatch outcome inline.
        const pkgIds = packages.map((p) => p.id);
        const deliveriesByPkg = new Map<string, DeliveryEntry[]>();
        if (pkgIds.length > 0) {
          const { data: dels } = await supabase
            .from("export_deliveries")
            .select(
              "id, release_package_id, receiver_id, format, http_status, error_message, dispatched_at",
            )
            .in("release_package_id", pkgIds)
            .order("dispatched_at", { ascending: false });
          const delRows = (dels ?? []) as DeliveryRow[];
          const receiverIds = Array.from(new Set(delRows.map((d) => d.receiver_id)));
          const receiverNameById = new Map<string, string>();
          if (receiverIds.length > 0) {
            const { data: rcvs } = await supabase
              .from("receivers")
              .select("id, name")
              .in("id", receiverIds);
            for (const r of rcvs ?? []) {
              receiverNameById.set(r.id as string, (r.name as string) ?? "—");
            }
          }
          for (const d of delRows) {
            const enriched: DeliveryEntry = {
              ...d,
              receiverName: receiverNameById.get(d.receiver_id) ?? "(unknown receiver)",
            };
            const list = deliveriesByPkg.get(d.release_package_id) ?? [];
            list.push(enriched);
            deliveriesByPkg.set(d.release_package_id, list);
          }
        }

        const merged: HistoryEntry[] = packages.map((p) => ({
          ...p,
          builtByName: p.built_by ? (nameById.get(p.built_by) ?? null) : null,
          amendmentReason: reasonByVersion.get(p.version) ?? null,
          deliveries: deliveriesByPkg.get(p.id) ?? [],
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
              <div className="mt-1.5 flex flex-wrap items-center gap-2 break-all font-mono text-[10px] text-muted-foreground">
                <span>seal: {e.body_sha256}</span>
                <button
                  type="button"
                  onClick={() => verifySeal(e.id, e.body_sha256)}
                  disabled={verify[e.id]?.status === "verifying"}
                  className="rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px] font-medium text-foreground hover:bg-muted/70 disabled:opacity-50"
                >
                  {verify[e.id]?.status === "verifying" ? "Verifying…" : "Verify seal"}
                </button>
                {verify[e.id]?.status === "ok" && (
                  <span className="rounded bg-primary/15 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-primary">
                    ✓ Seal valid
                  </span>
                )}
                {verify[e.id]?.status === "mismatch" && (
                  <span className="rounded bg-destructive/15 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-destructive">
                    ✗ Mismatch — body has been altered
                  </span>
                )}
                {verify[e.id]?.status === "error" && (
                  <span className="rounded bg-destructive/15 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-destructive">
                    Error: {(verify[e.id] as { message: string }).message}
                  </span>
                )}
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
              {e.deliveries.length > 0 && (
                <div className="mt-2 border-t border-border pt-2">
                  <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Dispatches ({e.deliveries.length})
                  </div>
                  <ul className="space-y-1">
                    {e.deliveries.map((d) => {
                      const ok = d.http_status !== null && d.http_status >= 200 && d.http_status < 300;
                      return (
                        <li
                          key={d.id}
                          className="flex flex-wrap items-center gap-2 text-[10px]"
                        >
                          <span
                            className={`rounded px-1.5 py-0.5 font-mono font-semibold ${
                              ok
                                ? "bg-primary/15 text-primary"
                                : "bg-destructive/15 text-destructive"
                            }`}
                          >
                            {ok ? "OK" : "FAIL"}
                          </span>
                          <span className="font-medium text-foreground">{d.receiverName}</span>
                          <span className="text-muted-foreground">[{d.format}]</span>
                          <span className="text-muted-foreground">
                            HTTP {d.http_status ?? "—"}
                          </span>
                          <span className="text-muted-foreground">
                            {new Date(d.dispatched_at).toLocaleString()}
                          </span>
                          {!ok && d.error_message && (
                            <span className="text-destructive">— {d.error_message}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
