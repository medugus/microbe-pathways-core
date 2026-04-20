// Admin: outbound receivers registry.
// Admins of the tenant can create / enable / disable / delete HTTP endpoints
// that release dispatches will POST to. RLS enforces the role gate; this UI
// just surfaces it.

import { useEffect, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { receiverPrefs } from "@/medugu/store/receiverPrefs";

interface ReceiverRow {
  id: string;
  tenant_id: string;
  name: string;
  endpoint_url: string;
  format: "fhir" | "hl7" | "json";
  bearer_token: string | null;
  enabled: boolean;
  created_at: string;
}

export const Route = createFileRoute("/admin/receivers")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: ReceiversAdminPage,
});

function ReceiversAdminPage() {
  const { hasRole, profile } = useAuth();
  const [rows, setRows] = useState<ReceiverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<"fhir" | "hl7" | "json">("fhir");
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = hasRole("admin");

  async function load() {
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase
      .from("receivers")
      .select("id, tenant_id, name, endpoint_url, format, bearer_token, enabled, created_at")
      .order("created_at", { ascending: false });
    if (error) setErr(error.message);
    setRows((data ?? []) as ReceiverRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!profile?.tenant_id) return;
    setSubmitting(true);
    setErr(null);
    try {
      const { error } = await supabase.from("receivers").insert({
        tenant_id: profile.tenant_id,
        name: name.trim(),
        endpoint_url: url.trim(),
        format,
        bearer_token: token.trim() || null,
        enabled: true,
      } as never);
      if (error) throw new Error(error.message);
      setName("");
      setUrl("");
      setToken("");
      setFormat("fhir");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function toggle(row: ReceiverRow) {
    const { error } = await supabase
      .from("receivers")
      .update({ enabled: !row.enabled } as never)
      .eq("id", row.id);
    if (error) setErr(error.message);
    await load();
  }

  async function remove(row: ReceiverRow) {
    if (!confirm(`Delete receiver "${row.name}"? Past delivery records remain.`)) return;
    const { error } = await supabase.from("receivers").delete().eq("id", row.id);
    if (error) setErr(error.message);
    await load();
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-sm">
        <p className="text-destructive">Admin role required.</p>
        <Link to="/" className="mt-2 inline-block text-primary underline">
          Return
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 text-sm">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Outbound receivers</h1>
          <p className="text-xs text-muted-foreground">
            HTTP endpoints that released and amended reports can be POSTed to.
          </p>
        </div>
        <Link to="/admin/users" className="text-xs text-primary hover:underline">
          ← Users
        </Link>
      </header>

      <form
        onSubmit={create}
        className="space-y-3 rounded-md border border-border bg-card p-4"
      >
        <h2 className="text-sm font-medium">Add receiver</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="rcv-name" className="text-xs">Name</Label>
            <Input
              id="rcv-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="EHR primary"
              required
              maxLength={100}
            />
          </div>
          <div>
            <Label htmlFor="rcv-format" className="text-xs">Format</Label>
            <select
              id="rcv-format"
              value={format}
              onChange={(e) => setFormat(e.target.value as "fhir" | "hl7" | "json")}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="fhir">FHIR R4 Bundle</option>
              <option value="hl7">HL7 v2.5 ORU^R01</option>
              <option value="json">Normalised JSON</option>
            </select>
          </div>
        </div>
        <div>
          <Label htmlFor="rcv-url" className="text-xs">Endpoint URL (HTTPS)</Label>
          <Input
            id="rcv-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://ehr.example.org/inbound/fhir"
            required
            pattern="https?://.+"
          />
        </div>
        <div>
          <Label htmlFor="rcv-token" className="text-xs">Bearer token (optional)</Label>
          <Input
            id="rcv-token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Sent as Authorization: Bearer …"
            maxLength={500}
          />
        </div>
        <Button type="submit" disabled={submitting || !name.trim() || !url.trim()}>
          {submitting ? "Adding…" : "Add receiver"}
        </Button>
        {err && <p className="text-xs text-destructive">{err}</p>}
      </form>

      <section>
        <h2 className="mb-2 text-sm font-medium">Configured receivers</h2>
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">No receivers yet.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.name}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                      {r.format}
                    </span>
                    {!r.enabled && (
                      <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">
                        disabled
                      </span>
                    )}
                  </div>
                  <div className="truncate font-mono text-[11px] text-muted-foreground">
                    {r.endpoint_url}
                  </div>
                  {r.bearer_token && (
                    <div className="text-[10px] text-muted-foreground">
                      bearer token configured
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => toggle(r)}>
                    {r.enabled ? "Disable" : "Enable"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(r)}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
