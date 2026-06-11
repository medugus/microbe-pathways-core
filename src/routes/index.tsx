// Hub — post-login landing page.
//
// Two primary entry points:
//   - Open case workspace  → /workspace (existing accession-to-release flow)
//   - Open Zone Reader     → opens the admin-configured Zone Reader app URL
//                            in a new browser tab
//
// This file is presentation-only. It does not contain workflow logic, does
// not mutate any store, and does not import engines. Counts are read from
// the existing accession store via its React binding; everything else
// (zone reader URL, preview-host detection) is read from the existing
// zoneReaderInboundConfig store.

import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/auth/RequireAuth";
import { SessionBar } from "@/auth/SessionBar";
import { CloudHydrationGate } from "@/medugu/store/CloudHydrationGate";
import { useMeduguState } from "@/medugu/store/useAccessionStore";
import { zoneReaderInboundConfig } from "@/medugu/store/zoneReaderInboundConfig";
import { WorkflowStage } from "@/medugu/domain/enums";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Medugu Hub — AMCE Microbiology" },
      {
        name: "description",
        content:
          "Medugu hub: open the case workspace or launch Zone Reader for disk-diffusion measurement.",
      },
    ],
  }),
  component: HubRoute,
});

function HubRoute() {
  return (
    <RequireAuth>
      <CloudHydrationGate>
        <div className="min-h-screen bg-background">
          <SessionBar />
          <HubBody />
        </div>
      </CloudHydrationGate>
    </RequireAuth>
  );
}

const STAGE_LABEL: Record<string, string> = {
  [WorkflowStage.Registered]: "Registered",
  [WorkflowStage.SpecimenReceived]: "Specimen received",
  [WorkflowStage.Microscopy]: "Microscopy",
  [WorkflowStage.Culture]: "Culture",
  [WorkflowStage.Isolate]: "Isolate",
  [WorkflowStage.AST]: "AST",
  [WorkflowStage.Stewardship]: "Stewardship",
  [WorkflowStage.IPC]: "IPC",
  [WorkflowStage.Validation]: "Validation",
  [WorkflowStage.Released]: "Released",
};

function HubBody() {
  const state = useMeduguState();
  const [, force] = useState(0);
  useEffect(
    () => zoneReaderInboundConfig.subscribe(() => force((n) => n + 1)),
    [],
  );

  const appUrl = zoneReaderInboundConfig.getAppUrl();
  const endpointUrl = zoneReaderInboundConfig.getEndpointUrl();
  const onPreview = zoneReaderInboundConfig.isPreviewEnvironment();

  const counts = useMemo(() => {
    const byStage = new Map<string, number>();
    let total = 0;
    for (const id of state.accessionOrder) {
      const a = state.accessions[id];
      if (!a) continue;
      total += 1;
      const s = a.workflowStatus;
      byStage.set(s, (byStage.get(s) ?? 0) + 1);
    }
    return { total, byStage };
  }, [state]);

  function launchZoneReader() {
    if (!appUrl) return;
    window.open(appUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Medugu Hub</h1>
        <p className="text-sm text-muted-foreground">
          Pick where to work. Engines, rules, and release governance stay the
          same across both entry points.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {/* Case workspace card */}
        <article className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Open case workspace</h2>
            <p className="text-sm text-muted-foreground">
              Continuous accession-to-release workflow. Patient and specimen
              capture, microscopy, isolate identification, AST interpretation
              with expert rules, stewardship review, IPC signals, validation
              and governed release.
            </p>
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>• EUCAST 2026 breakpoint registry</li>
            <li>• AST expert rules &amp; selective-reporting cascades</li>
            <li>• Stewardship + IPC engines</li>
            <li>• Hash-bound, sealed release reports</li>
          </ul>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted-foreground">
              {counts.total > 0
                ? `${counts.total} case${counts.total === 1 ? "" : "s"} loaded`
                : "No cases yet"}
            </span>
            <Button asChild>
              <Link to="/workspace">Open case workspace</Link>
            </Button>
          </div>
        </article>

        {/* Zone Reader card — hidden entirely when no app URL is configured so
            a LIMS-only deployment shows no reference to the Zone Reader. */}
        {appUrl && (
          <article className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
            <div className="space-y-1">
              <h2 className="text-base font-semibold">Open Zone Reader</h2>
              <p className="text-sm text-muted-foreground">
                External disk-diffusion measurement app. Imports a Medugu LIMS
                worklist, captures zone diameters, and returns coded ZoneResult
                rows to this deployment for interpretation and release.
              </p>
            </div>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>• Worklist JSON export from Medugu</li>
              <li>• Disk-diffusion measurement in Zone Reader</li>
              <li>• ZoneResult POST back to Medugu inbound endpoint</li>
              <li>• Medugu interprets, validates, releases</li>
            </ul>

            {onPreview && (
              <p
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                Preview host detected — do not use this origin for live Zone
                Reader send. The launch button still opens the configured app,
                but ZoneResult must target the production Medugu host.
              </p>
            )}

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">
                <code className="font-mono break-all">{appUrl}</code>
              </span>
              <Button
                type="button"
                onClick={launchZoneReader}
                title="Opens Zone Reader in a new tab"
              >
                Launch Zone Reader ↗
              </Button>
            </div>
          </article>
        )}
      </section>

      {/* Integration strip */}
      <section
        aria-label="Zone Reader integration path"
        className="rounded-lg border border-dashed border-border bg-muted/30 p-4"
      >
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Integration path
        </h3>
        <ol className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <li className="rounded bg-background px-2 py-1 font-medium">
            1. Worklist export
          </li>
          <li className="text-muted-foreground">→</li>
          <li className="rounded bg-background px-2 py-1 font-medium">
            2. Measure (Zone Reader)
          </li>
          <li className="text-muted-foreground">→</li>
          <li className="rounded bg-background px-2 py-1 font-medium">
            3. ZoneResult return
          </li>
          <li className="text-muted-foreground">→</li>
          <li className="rounded bg-background px-2 py-1 font-medium">
            4. Interpret &amp; release
          </li>
        </ol>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Inbound endpoint:{" "}
          <code className="font-mono">{endpointUrl}</code>
        </p>
      </section>

      {/* Workflow counts (cheap: derived from in-memory store) */}
      {counts.total > 0 && (
        <section aria-label="Cases by stage" className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Cases by stage
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.values(WorkflowStage).map((stage) => {
              const n = counts.byStage.get(stage) ?? 0;
              if (n === 0) return null;
              return (
                <Badge key={stage} variant="secondary" className="font-normal">
                  {STAGE_LABEL[stage] ?? stage}: {n}
                </Badge>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
