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

import React, { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/auth/AuthContext";
import { SessionBar } from "@/auth/SessionBar";
import { CloudHydrationGate } from "@/medugu/store/CloudHydrationGate";
import { useMeduguState } from "@/medugu/store/useAccessionStore";
import { zoneReaderInboundConfig } from "@/medugu/store/zoneReaderInboundConfig";
import { WorkflowStage } from "@/medugu/domain/enums";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MarketingLanding } from "@/components/landing/MarketingLanding";
import {
  ArrowRight,
  FlaskConical,
  Radar,
  ShieldCheck,
  Activity,
  GitBranch,
  Sparkles,
  ExternalLink,
} from "lucide-react";

const DEEP_NAVY = "#020617";
const CARD_NAVY = "#0F2440";
const ICE = "#E6EEFB";
const SKY = "#93C5FD";
const BLUE_ACCENT = "#3B82F6";
const ELECTRIC = "#60A5FA";
const DIM = "#6E89B5";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Medugu — From culture plate to clinical action" },
      {
        name: "description",
        content:
          "Audit-grade microbiology workflow with EUCAST 2026, AST expert rules, stewardship, IPC surveillance and sealed release.",
      },
      { property: "og:title", content: "Medugu — From culture plate to clinical action" },
      {
        property: "og:description",
        content:
          "Audit-grade microbiology workflow with EUCAST 2026, AST expert rules, stewardship and sealed release.",
      },
    ],
  }),
  component: HubRoute,
});

function HubRoute() {
  const { loading, session } = useAuth();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  if (!hydrated || loading) return <div className="min-h-screen bg-background" />;
  if (!session) return <MarketingLanding />;

  return (
    <CloudHydrationGate>
      <div
        className="relative min-h-screen overflow-hidden"
        style={{ background: DEEP_NAVY, color: ICE }}
      >
        <AmbientBackdrop />
        <div className="relative z-10">
          <SessionBar />
          <HubBody />
        </div>
      </div>
    </CloudHydrationGate>
  );
}

function AmbientBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 10% 0%, rgba(59,130,246,0.20), transparent 60%), radial-gradient(45% 45% at 92% 18%, rgba(30,58,138,0.40), transparent 65%), radial-gradient(80% 60% at 50% 110%, rgba(59,130,246,0.10), transparent 70%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(230,238,251,0.5) 0 1px, transparent 1px 80px), repeating-linear-gradient(90deg, rgba(230,238,251,0.5) 0 1px, transparent 1px 80px)",
        }}
      />
    </div>
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
  useEffect(() => zoneReaderInboundConfig.subscribe(() => force((n) => n + 1)), []);

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

  const cardBase: React.CSSProperties = {
    background: `linear-gradient(180deg, ${CARD_NAVY} 0%, rgba(11,26,51,0.85) 100%)`,
    border: `1px solid rgba(96,165,250,0.18)`,
    boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset, 0 30px 60px -30px rgba(0,0,0,0.6)",
  };

  return (
    <main className="mx-auto max-w-6xl space-y-10 px-6 py-10">
      {/* Hero header */}
      <header className="space-y-4">
        <div
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em]"
          style={{
            color: SKY,
            background: "rgba(59,130,246,0.10)",
            border: "1px solid rgba(96,165,250,0.25)",
          }}
        >
          <Sparkles className="h-3 w-3" /> Medugu Hub
        </div>
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl" style={{ color: ICE }}>
          Choose your entry point.
        </h1>
        <p className="max-w-2xl text-base leading-relaxed" style={{ color: DIM }}>
          The same engines, rules, and release governance run under both surfaces — pick the one
          that fits the bench in front of you.
        </p>
      </header>

      {/* Primary entry cards */}
      <section className={`grid gap-6 ${appUrl ? "md:grid-cols-2" : ""}`}>
        {/* Case workspace card */}
        <article
          className="group relative flex flex-col gap-5 overflow-hidden rounded-2xl p-7"
          style={cardBase}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-40 blur-3xl transition-opacity group-hover:opacity-70"
            style={{ background: BLUE_ACCENT }}
          />
          <div className="relative flex items-start justify-between">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{
                background: "rgba(59,130,246,0.15)",
                border: "1px solid rgba(96,165,250,0.30)",
              }}
            >
              <FlaskConical className="h-6 w-6" style={{ color: ELECTRIC }} />
            </div>
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
              style={{
                color: SKY,
                background: "rgba(96,165,250,0.10)",
                border: "1px solid rgba(96,165,250,0.25)",
              }}
            >
              LIMS
            </span>
          </div>
          <div className="relative space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight" style={{ color: ICE }}>
              Case workspace
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: DIM }}>
              Continuous accession-to-release workflow. Patient and specimen capture, microscopy,
              isolate ID, AST with expert rules, stewardship review, IPC signals, validation and
              governed release.
            </p>
          </div>
          <ul className="relative space-y-2 text-sm" style={{ color: "rgba(230,238,251,0.78)" }}>
            <FeatureLine icon={<ShieldCheck className="h-4 w-4" />}>
              EUCAST 2026 breakpoint registry
            </FeatureLine>
            <FeatureLine icon={<GitBranch className="h-4 w-4" />}>
              AST expert rules &amp; selective-reporting cascades
            </FeatureLine>
            <FeatureLine
              icon={<Sparkles className="h-4 w-4" />}
              detail="Bug-drug mismatch alerts, IV-to-oral switch prompts, and de-escalation recommendations surfaced at review."
            >
              Antimicrobial Stewardship (AMS)
            </FeatureLine>
            <FeatureLine icon={<Activity className="h-4 w-4" />}>
              IPC surveillance &amp; signals
            </FeatureLine>
            <FeatureLine icon={<ShieldCheck className="h-4 w-4" />}>
              Hash-bound, sealed release reports
            </FeatureLine>
          </ul>
          <div
            className="relative mt-2 flex items-center justify-between border-t pt-5"
            style={{ borderColor: "rgba(96,165,250,0.15)" }}
          >
            <span className="text-xs font-medium" style={{ color: DIM }}>
              {counts.total > 0
                ? `${counts.total} case${counts.total === 1 ? "" : "s"} loaded`
                : "No cases yet"}
            </span>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                asChild
                variant="outline"
                className="rounded-full px-4"
                style={{
                  background: "transparent",
                  color: ICE,
                  border: `1px solid ${ELECTRIC}`,
                }}
              >
                <Link to="/antibiogram">Live antibiogram</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="rounded-full px-4"
                style={{
                  background: "transparent",
                  color: ICE,
                  border: `1px solid rgba(96,165,250,0.45)`,
                }}
              >
                <Link to="/outbreak">Outbreak dashboard</Link>
              </Button>
              <Button
                asChild
                className="rounded-full px-5"
                style={{
                  background: ICE,
                  color: DEEP_NAVY,
                  boxShadow: "0 10px 30px -10px rgba(96,165,250,0.5)",
                }}
              >
                <Link to="/workspace">
                  Open workspace <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </article>

        {/* Zone Reader card */}
        {appUrl && (
          <article
            className="group relative flex flex-col gap-5 overflow-hidden rounded-2xl p-7"
            style={cardBase}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full opacity-30 blur-3xl transition-opacity group-hover:opacity-60"
              style={{ background: "#1E3A8A" }}
            />
            <div className="relative flex items-start justify-between">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl"
                style={{
                  background: "rgba(96,165,250,0.12)",
                  border: "1px solid rgba(96,165,250,0.30)",
                }}
              >
                <Radar className="h-6 w-6" style={{ color: ELECTRIC }} />
              </div>
              <span
                className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
                style={{
                  color: SKY,
                  background: "rgba(96,165,250,0.10)",
                  border: "1px solid rgba(96,165,250,0.25)",
                }}
              >
                Disk diffusion
              </span>
            </div>
            <div className="relative space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight" style={{ color: ICE }}>
                Zone Reader
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: DIM }}>
                External measurement app. Imports a Medugu LIMS worklist, captures zone diameters,
                and returns coded ZoneResult rows for interpretation and release here.
              </p>
            </div>
            <ul className="relative space-y-2 text-sm" style={{ color: "rgba(230,238,251,0.78)" }}>
              <FeatureLine icon={<GitBranch className="h-4 w-4" />}>
                Worklist JSON export from Medugu
              </FeatureLine>
              <FeatureLine icon={<Radar className="h-4 w-4" />}>
                Disk-diffusion measurement in Zone Reader
              </FeatureLine>
              <FeatureLine icon={<Activity className="h-4 w-4" />}>
                ZoneResult POST back to inbound endpoint
              </FeatureLine>
              <FeatureLine icon={<ShieldCheck className="h-4 w-4" />}>
                Medugu interprets, validates, releases
              </FeatureLine>
            </ul>

            {onPreview && (
              <p
                role="alert"
                className="relative rounded-lg px-3 py-2 text-xs"
                style={{
                  color: "#fda29b",
                  background: "rgba(220,38,38,0.10)",
                  border: "1px solid rgba(220,38,38,0.35)",
                }}
              >
                Preview host detected — do not use this origin for live Zone Reader send.
              </p>
            )}

            <div
              className="relative mt-2 flex items-center justify-between gap-4 border-t pt-5"
              style={{ borderColor: "rgba(96,165,250,0.15)" }}
            >
              <code
                className="truncate font-mono text-[11px]"
                style={{ color: DIM }}
                title={appUrl}
              >
                {appUrl}
              </code>
              <Button
                type="button"
                onClick={launchZoneReader}
                className="shrink-0 rounded-full px-5"
                style={{
                  background: "transparent",
                  color: ICE,
                  border: `1px solid ${ELECTRIC}`,
                }}
              >
                Launch <ExternalLink className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </article>
        )}
      </section>

      {/* Integration strip */}
      {appUrl && (
        <section
          aria-label="Zone Reader integration path"
          className="rounded-2xl p-6"
          style={{
            background: "rgba(15,36,64,0.55)",
            border: "1px dashed rgba(96,165,250,0.30)",
          }}
        >
          <h3
            className="text-[11px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: SKY }}
          >
            Integration path
          </h3>
          <ol className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
            {[
              "Worklist export",
              "Measure (Zone Reader)",
              "ZoneResult return",
              "Interpret & release",
            ].map((label, i, arr) => (
              <React.Fragment key={label}>
                <li
                  className="rounded-full px-3 py-1.5 font-medium"
                  style={{
                    background: "rgba(2,6,23,0.55)",
                    border: "1px solid rgba(96,165,250,0.20)",
                    color: ICE,
                  }}
                >
                  <span style={{ color: ELECTRIC }}>{i + 1}.</span> {label}
                </li>
                {i < arr.length - 1 && <li style={{ color: DIM }}>→</li>}
              </React.Fragment>
            ))}
          </ol>
          <p className="mt-4 text-[11px]" style={{ color: DIM }}>
            Inbound endpoint:{" "}
            <code className="font-mono" style={{ color: SKY }}>
              {endpointUrl}
            </code>
          </p>
        </section>
      )}

      {/* Workflow counts */}
      {counts.total > 0 && (
        <section aria-label="Cases by stage" className="space-y-3">
          <h3
            className="text-[11px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: SKY }}
          >
            Cases by stage
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.values(WorkflowStage).map((stage) => {
              const n = counts.byStage.get(stage) ?? 0;
              if (n === 0) return null;
              return (
                <Badge
                  key={stage}
                  variant="outline"
                  className="rounded-full border-0 px-3 py-1 font-normal"
                  style={{
                    background: "rgba(96,165,250,0.10)",
                    color: ICE,
                    border: "1px solid rgba(96,165,250,0.25)",
                  }}
                >
                  {STAGE_LABEL[stage] ?? stage}
                  <span className="ml-2 font-semibold" style={{ color: ELECTRIC }}>
                    {n}
                  </span>
                </Badge>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}

function FeatureLine({
  icon,
  children,
  detail,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  detail?: string;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
        style={{
          background: "rgba(96,165,250,0.12)",
          color: ELECTRIC,
        }}
      >
        {icon}
      </span>
      <div>
        <span>{children}</span>
        {detail && (
          <p className="mt-0.5 text-[11px] leading-relaxed" style={{ color: DIM }}>
            {detail}
          </p>
        )}
      </div>
    </li>
  );
}
