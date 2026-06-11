// Admin · Zone Reader inbound configuration.
//
// Surfaces the inbound endpoint URL and bearer token an operator must paste
// into Zone Reader so it can POST ZoneResult JSON to this Medugu deployment.
//
// Scope boundaries:
//   - admin-gated (same pattern as admin.config / admin.users)
//   - token is browser-phase per-tenant in localStorage
//     (see src/medugu/store/zoneReaderInboundConfig.ts)
//   - this page does NOT create the inbound endpoint, verify webhook
//     signatures, poll, or open sockets. It only exposes configuration.

import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { RequireAuth } from "@/auth/RequireAuth";
import { SessionBar } from "@/auth/SessionBar";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { copyText } from "@/medugu/utils/exportHelpers";
import { zoneReaderInboundConfig } from "@/medugu/store/zoneReaderInboundConfig";

export const Route = createFileRoute("/admin/zone-reader")({
  head: () => ({
    meta: [
      { title: "Admin · Zone Reader live send — Medugu" },
      {
        name: "description",
        content:
          "Admin-only: view the inbound ZoneResult endpoint URL and manage the bearer token that Zone Reader must use to POST measurements.",
      },
    ],
  }),
  component: AdminZoneReaderPage,
});

function AdminZoneReaderPage() {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-background">
        <SessionBar />
        <AdminGate />
      </div>
    </RequireAuth>
  );
}

function AdminGate() {
  const { hasRole, loading, tenantId } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    if (!hasRole("admin")) {
      toast.error("Admin role required");
      void navigate({ to: "/", replace: true });
    }
  }, [loading, hasRole, navigate]);
  if (loading || !tenantId || !hasRole("admin")) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Checking permissions…</div>
    );
  }
  return <AdminInner tenantId={tenantId} />;
}

function AdminInner({ tenantId }: { tenantId: string }) {
  const [, force] = useState(0);
  useEffect(
    () => zoneReaderInboundConfig.subscribe(() => force((n) => n + 1)),
    [],
  );
  const [revealed, setRevealed] = useState(false);

  const endpointUrl = zoneReaderInboundConfig.getEndpointUrl();
  const productionBase = zoneReaderInboundConfig.getProductionBaseUrl();
  const overrideBase = zoneReaderInboundConfig.getProductionBaseUrlOverride();
  const defaultBase = zoneReaderInboundConfig.getDefaultProductionBaseUrl();
  const currentOrigin = zoneReaderInboundConfig.getCurrentOrigin();
  const onPreview = zoneReaderInboundConfig.isPreviewEnvironment();
  const [baseDraft, setBaseDraft] = useState(overrideBase ?? "");
  const appUrl = zoneReaderInboundConfig.getAppUrl();
  const [appUrlDraft, setAppUrlDraft] = useState(appUrl ?? "");
  const current = zoneReaderInboundConfig.getToken(tenantId);

  function saveAppUrl() {
    const result = zoneReaderInboundConfig.setAppUrl(appUrlDraft);
    if (result.ok) {
      toast.success("Zone Reader app URL saved");
      setAppUrlDraft(result.value);
    } else {
      toast.error(result.reason);
    }
  }

  function clearAppUrl() {
    zoneReaderInboundConfig.clearAppUrl();
    setAppUrlDraft("");
    toast.success("Zone Reader app URL cleared");
  }

  async function copy(label: string, value: string) {
    const ok = await copyText(value);
    toast[ok ? "success" : "error"](
      ok ? `${label} copied` : `Could not copy ${label}`,
    );
  }

  function saveBase() {
    const result = zoneReaderInboundConfig.setProductionBaseUrl(baseDraft);
    if (result.ok) {
      toast.success("Production base URL saved");
      setBaseDraft(result.value);
    } else {
      toast.error(result.reason);
    }
  }

  function clearBase() {
    zoneReaderInboundConfig.clearProductionBaseUrlOverride();
    setBaseDraft("");
    toast.success("Reverted to built-in default");
  }

  function generate() {
    const next = zoneReaderInboundConfig.generateToken(tenantId);
    setRevealed(true);
    toast.success(
      current
        ? "New token generated — previous token is now invalid"
        : "Token generated",
    );
    void copyText(next.token);
  }

  function revoke() {
    if (!confirm("Revoke the current ZoneResult token? Zone Reader will be unable to send until a new token is generated and pasted in.")) return;
    zoneReaderInboundConfig.revokeToken(tenantId);
    setRevealed(false);
    toast.success("Token revoked");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 text-sm">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Zone Reader live send</h1>
          <p className="text-xs text-muted-foreground">
            Configuration that Zone Reader needs to POST ZoneResult JSON back into
            Medugu. Admin-only.
          </p>
        </div>
        <Link to="/admin/receivers" className="text-xs text-primary hover:underline">
          ← Receivers
        </Link>
      </header>

      {onPreview && (
        <section
          role="alert"
          className="space-y-2 rounded-md border-2 border-destructive bg-destructive/10 p-4"
        >
          <h2 className="text-sm font-semibold text-destructive">
            Preview host detected — do not use this origin for live send
          </h2>
          <p className="text-xs text-destructive/90">
            You are viewing this admin page from a preview / non-production
            origin (<code className="font-mono">{currentOrigin || "unknown"}</code>).
            Preview URLs are ephemeral and must never be configured in Zone
            Reader as the live ZoneResult destination. The endpoint URL shown
            below is intentionally pinned to the stable production host
            (<code className="font-mono">{productionBase}</code>) and is what
            Zone Reader must use.
          </p>
        </section>
      )}

      <section className="space-y-3 rounded-md border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Production base URL</h2>
        <p className="text-xs text-muted-foreground">
          Stable, published Medugu host used to build the Zone Reader endpoint
          URL. This is never derived from the current browser origin, so the
          value below is safe to hand to Zone Reader even when this page is
          opened from a preview environment.
        </p>
        <div className="text-xs">
          <div>
            Built-in default:{" "}
            <code className="font-mono">{defaultBase}</code>
          </div>
          <div>
            In effect:{" "}
            <code className="font-mono">{productionBase}</code>
            {overrideBase ? " (admin override)" : " (default)"}
          </div>
        </div>
        <div>
          <Label htmlFor="zr-base" className="text-xs">
            Override (https origin only)
          </Label>
          <div className="flex gap-2">
            <Input
              id="zr-base"
              value={baseDraft}
              onChange={(e) => setBaseDraft(e.target.value)}
              placeholder={defaultBase}
              className="font-mono text-xs"
            />
            <Button type="button" onClick={saveBase}>
              Save
            </Button>
            {overrideBase && (
              <Button type="button" variant="ghost" onClick={clearBase}>
                Reset
              </Button>
            )}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Must be an <code className="font-mono">https://</code> origin
            (no path). Leave blank and Reset to use the built-in default.
          </p>
        </div>
      </section>

      <section className="space-y-3 rounded-md border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Zone Reader app URL</h2>
        <p className="text-xs text-muted-foreground">
          The Zone Reader web app the Hub "Launch Zone Reader" button opens
          in a new tab. Must be an <code className="font-mono">https://</code>{" "}
          URL. If unset, the Hub launch button is disabled.
        </p>
        <div>
          <Label htmlFor="zr-app" className="text-xs">
            App URL
          </Label>
          <div className="flex gap-2">
            <Input
              id="zr-app"
              value={appUrlDraft}
              onChange={(e) => setAppUrlDraft(e.target.value)}
              placeholder={zoneReaderInboundConfig.getDefaultAppUrl()}
              className="font-mono text-xs"
            />
            <Button type="button" onClick={saveAppUrl}>
              Save
            </Button>
            {appUrl && (
              <Button type="button" variant="ghost" onClick={clearAppUrl}>
                Clear
              </Button>
            )}
          </div>
          {onPreview && appUrl && (
            <p className="mt-1 text-[11px] text-destructive">
              Preview host detected — the launch button on the Hub will show
              a preview-host warning until you open Medugu from the published
              production URL.
            </p>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground">
            In effect:{" "}
            {appUrl ? (
              <code className="font-mono">{appUrl}</code>
            ) : (
              <span>none — launch button disabled</span>
            )}
          </p>
        </div>
      </section>




      <section className="space-y-3 rounded-md border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Inbound endpoint URL</h2>
        <p className="text-xs text-muted-foreground">
          Paste this full URL into Zone Reader as the ZoneResult destination.
          Zone Reader must use the absolute URL — a relative path will not work.
        </p>
        <div>
          <Label htmlFor="zr-endpoint" className="text-xs">
            Endpoint
          </Label>
          <div className="flex gap-2">
            <Input
              id="zr-endpoint"
              readOnly
              value={endpointUrl}
              className="font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => void copy("Endpoint URL", endpointUrl)}
            >
              Copy
            </Button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Path: <code className="font-mono">{zoneReaderInboundConfig.getEndpointPath()}</code>
          </p>
        </div>
      </section>

      <section className="space-y-3 rounded-md border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Bearer token</h2>
          {current && (
            <span className="text-[11px] text-muted-foreground">
              Generated {new Date(current.generatedAt).toLocaleString()}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Zone Reader must send this as <code className="font-mono">Authorization: Bearer &lt;token&gt;</code>.
          Treat it like a password: only admins should see it; regenerating
          immediately invalidates the previous value.
        </p>

        {current ? (
          <div>
            <Label htmlFor="zr-token" className="text-xs">
              Current token
            </Label>
            <div className="flex gap-2">
              <Input
                id="zr-token"
                readOnly
                type={revealed ? "text" : "password"}
                value={current.token}
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setRevealed((r) => !r)}
              >
                {revealed ? "Hide" : "Reveal"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void copy("Token", current.token)}
              >
                Copy
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No token generated yet for this tenant.
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="button" onClick={generate}>
            {current ? "Regenerate token" : "Generate token"}
          </Button>
          {current && (
            <Button type="button" variant="ghost" onClick={revoke}>
              Revoke
            </Button>
          )}
        </div>
      </section>

      <section className="space-y-2 rounded-md border border-dashed border-border bg-muted/30 p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Operator notes</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Endpoint URL and token are scoped per tenant. A new tenant starts
            with no token until an admin generates one.
          </li>
          <li>
            Regenerating the token invalidates the previous value immediately.
            Update Zone Reader as soon as you regenerate.
          </li>
          <li>
            Token storage is browser-phase (this device only). For multi-device
            admin workflows, generate the token once and distribute it through
            your normal secret-sharing channel.
          </li>
          <li>
            See{" "}
            <code className="font-mono">
              docs/acceptance/zone-result-live-send-setup-current.md
            </code>{" "}
            for the full setup procedure.
          </li>
        </ul>
      </section>
    </div>
  );
}
