// Read-only tenant audit log viewer.
// Shows the most recent governance-relevant events from public.audit_event,
// scoped to the current tenant by RLS, with simple filters.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/auth/RequireAuth";
import { SessionBar } from "@/auth/SessionBar";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AuditRow {
  id: string;
  at: string;
  action: string;
  entity: string;
  entity_id: string | null;
  field: string | null;
  actor_label: string | null;
  actor_user_id: string | null;
  reason: string | null;
  old_value: unknown;
  new_value: unknown;
}

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title: "Audit log — Medugu" },
      { name: "description", content: "Tenant-scoped governance audit trail." },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-background">
        <SessionBar />
        <AuditViewer />
      </div>
    </RequireAuth>
  );
}

function AuditViewer() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [actionQuery, setActionQuery] = useState("");
  const [accessionQuery, setAccessionQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void supabase
      .from("audit_event")
      .select("*")
      .order("at", { ascending: false })
      .limit(500)
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          setError(err.message);
        } else {
          setRows((data ?? []) as AuditRow[]);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (entityFilter !== "all" && r.entity !== entityFilter) return false;
      if (actionQuery && !r.action.toLowerCase().includes(actionQuery.toLowerCase())) return false;
      if (
        accessionQuery &&
        !(r.entity_id ?? "").toLowerCase().includes(accessionQuery.toLowerCase())
      )
        return false;
      return true;
    });
  }, [rows, entityFilter, actionQuery, accessionQuery]);

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Audit log</h1>
          <p className="text-xs text-muted-foreground">
            Tenant-scoped, append-only. Most recent {rows.length} events.
          </p>
        </div>
        <Link to="/" className="text-sm text-primary underline-offset-4 hover:underline">
          ← Back to lab
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Entity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entities</SelectItem>
            <SelectItem value="accession">Accession</SelectItem>
            <SelectItem value="isolate">Isolate</SelectItem>
            <SelectItem value="ast">AST</SelectItem>
            <SelectItem value="release_package">Release package</SelectItem>
            <SelectItem value="workflow">Workflow</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Filter by action…"
          value={actionQuery}
          onChange={(e) => setActionQuery(e.target.value)}
          className="w-64"
        />
        <Input
          placeholder="Filter by entity id…"
          value={accessionQuery}
          onChange={(e) => setAccessionQuery(e.target.value)}
          className="w-64"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setEntityFilter("all");
            setActionQuery("");
            setAccessionQuery("");
          }}
        >
          Reset
        </Button>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {error && <div className="text-sm text-destructive">Error: {error}</div>}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="p-2 font-medium">When</th>
                <th className="p-2 font-medium">Actor</th>
                <th className="p-2 font-medium">Action</th>
                <th className="p-2 font-medium">Entity</th>
                <th className="p-2 font-medium">Field</th>
                <th className="p-2 font-medium">Entity ID</th>
                <th className="p-2 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="p-2 font-mono">{new Date(r.at).toLocaleString()}</td>
                  <td className="p-2">{r.actor_label ?? r.actor_user_id ?? "system"}</td>
                  <td className="p-2 font-mono">{r.action}</td>
                  <td className="p-2">{r.entity}</td>
                  <td className="p-2 font-mono text-muted-foreground">{r.field ?? "—"}</td>
                  <td className="p-2 font-mono text-muted-foreground">{r.entity_id ?? "—"}</td>
                  <td className="p-2 text-muted-foreground">{r.reason ?? "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-muted-foreground">
                    No matching events.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
