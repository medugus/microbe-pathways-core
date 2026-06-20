import { useMemo } from "react";
import type { MeduguState } from "../../domain/types";
import {
  buildClinicalAssuranceReport,
  type ClinicalAssuranceStatus,
} from "../../logic/clinicalAssurance";

const STATUS_LABEL: Record<ClinicalAssuranceStatus, string> = {
  ready: "Demo strength",
  watch: "Needs strengthening",
  gap: "Priority gap",
};

const STATUS_STYLE: Record<ClinicalAssuranceStatus, string> = {
  ready: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800",
  watch: "border-sky-500/30 bg-sky-500/10 text-sky-800",
  gap: "border-amber-500/30 bg-amber-500/10 text-amber-800",
};

export function ClinicalAssurancePanel({ state }: { state: MeduguState }) {
  const report = useMemo(() => buildClinicalAssuranceReport(state), [state]);

  return (
    <section className="space-y-4 rounded-lg border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-sky-50 p-4">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-primary">
            Investor and pilot readiness
          </div>
          <h4 className="mt-1 text-base font-semibold text-foreground">
            Culture LIMS clinical assurance pack
          </h4>
          <p className="mt-2 text-sm text-muted-foreground">{report.investorNarrative}</p>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Overall readiness
              </div>
              <div className="mt-1 text-3xl font-semibold text-foreground">
                {report.totalScore}%
              </div>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${STATUS_STYLE[report.status]}`}>
              {STATUS_LABEL[report.status]}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.max(5, report.totalScore)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        {report.headlineMetrics.map((metric) => (
          <div key={metric.label} className="rounded-md border border-border bg-card p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {metric.label}
            </div>
            <div className="mt-1 text-xl font-semibold text-foreground">{metric.value}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{metric.detail}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {report.cards.map((card) => (
          <article key={card.id} className="rounded-md border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h5 className="text-sm font-semibold text-foreground">{card.title}</h5>
                <p className="mt-1 text-xs text-muted-foreground">{card.headline}</p>
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[card.status]}`}>
                {card.score}%
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${card.score}%` }} />
            </div>
            <CapabilityList title="Evidence" items={card.evidence} />
            {card.gaps.length > 0 && <CapabilityList title="Gaps" items={card.gaps} tone="warning" />}
            <CapabilityList title="Next actions" items={card.nextActions} />
          </article>
        ))}
      </div>
    </section>
  );
}

function CapabilityList({
  title,
  items,
  tone = "default",
}: {
  title: string;
  items: string[];
  tone?: "default" | "warning";
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3">
      <div
        className={`text-[10px] font-semibold uppercase tracking-wide ${
          tone === "warning" ? "text-amber-700" : "text-muted-foreground"
        }`}
      >
        {title}
      </div>
      <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="leading-snug">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
