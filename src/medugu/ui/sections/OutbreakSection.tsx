import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buildOutbreakSurveillanceReport } from "../../logic/outbreakEngine";
import type {
  OutbreakCandidatePair,
  OutbreakChartPoint,
  OutbreakIsolateSnapshot,
  OutbreakTimelinePoint,
} from "../../logic/outbreakEngine";
import { meduguActions, useMeduguState } from "../../store/useAccessionStore";

function severityClass(severity: OutbreakCandidatePair["severity"]): string {
  if (severity === "high") return "border-destructive bg-destructive/10 text-destructive";
  if (severity === "watch") return "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300";
  return "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300";
}

function metricTone(value: number, kind: "high" | "watch" | "neutral" = "neutral"): string {
  if (value === 0) return "text-muted-foreground";
  if (kind === "high") return "text-destructive";
  if (kind === "watch") return "text-amber-700 dark:text-amber-300";
  return "text-foreground";
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatDate(value?: string): string {
  if (!value) return "not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDays(days: number): string {
  if (!Number.isFinite(days)) return "date unavailable";
  if (days < 1) return "same day";
  const rounded = Math.round(days * 10) / 10;
  return `${rounded} day${rounded === 1 ? "" : "s"}`;
}

export function OutbreakSection() {
  const state = useMeduguState();
  const [selectedPairId, setSelectedPairId] = useState<string>("");

  const report = useMemo(
    () => buildOutbreakSurveillanceReport(state.accessions, state.activeAccessionId),
    [state.accessions, state.activeAccessionId],
  );

  const selectedPair =
    report.candidatePairs.find((pair) => pair.id === selectedPairId) ??
    report.candidatePairs[0] ??
    null;

  return (
    <div className="space-y-4">
      <header className="rounded-md border border-border bg-background p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-foreground">Outbreak surveillance</h4>
            <p className="mt-1 max-w-4xl text-xs text-muted-foreground">
              Flags potentially identical isolate pairs using organism, patient separation,
              timing, location, phenotype and AST concordance. Click a pair to review the
              evidence and IPC handoff text.
            </p>
          </div>
          <span className="rounded-full border border-border bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground">
            Phenotypic signal, not genomic confirmation
          </span>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">{report.limitationNote}</p>
      </header>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <MetricCard
          label="Comparable isolates"
          value={report.summary.totalComparableIsolates}
          tone={metricTone(report.summary.totalComparableIsolates)}
        />
        <MetricCard
          label="Candidate pairs"
          value={report.summary.candidatePairCount}
          tone={metricTone(report.summary.candidatePairCount)}
        />
        <MetricCard
          label="High priority"
          value={report.summary.highRiskPairCount}
          tone={metricTone(report.summary.highRiskPairCount, "high")}
        />
        <MetricCard
          label="Outbreak watch"
          value={report.summary.watchPairCount}
          tone={metricTone(report.summary.watchPairCount, "watch")}
        />
        <MetricCard
          label="This case linked"
          value={report.summary.activeAccessionPairCount}
          tone={metricTone(report.summary.activeAccessionPairCount, "watch")}
        />
      </div>

      {report.candidatePairs.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 p-5 text-sm text-muted-foreground">
          No cross-patient isolate pairs currently reach the outbreak review threshold. The
          module will populate as matching organisms with close timing, location or AST
          similarity are loaded.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            <ChartCard title="Candidate pairs by organism" data={report.organismChart} />
            <ChartCard title="Linked isolates by ward/unit" data={report.wardChart} />
            <TimelineChart title="Linked isolates over time" data={report.timelineChart} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.4fr)]">
            <CandidateList
              pairs={report.candidatePairs}
              selectedPairId={selectedPair?.id ?? ""}
              onSelect={setSelectedPairId}
            />
            {selectedPair && <CandidateDetail pair={selectedPair} />}
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function ChartCard({ title, data }: { title: string; data: OutbreakChartPoint[] }) {
  return (
    <section className="rounded-md border border-border bg-card p-3">
      <h5 className="text-xs font-semibold text-foreground">{title}</h5>
      {data.length === 0 ? (
        <p className="mt-8 text-center text-xs text-muted-foreground">No chart data yet.</p>
      ) : (
        <div className="mt-2 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
              <YAxis
                type="category"
                dataKey="label"
                width={116}
                tick={{ fontSize: 10 }}
                interval={0}
              />
              <Tooltip />
              <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function TimelineChart({ title, data }: { title: string; data: OutbreakTimelinePoint[] }) {
  return (
    <section className="rounded-md border border-border bg-card p-3">
      <h5 className="text-xs font-semibold text-foreground">{title}</h5>
      {data.length === 0 ? (
        <p className="mt-8 text-center text-xs text-muted-foreground">No timeline data yet.</p>
      ) : (
        <div className="mt-2 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#0f766e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function CandidateList({
  pairs,
  selectedPairId,
  onSelect,
}: {
  pairs: OutbreakCandidatePair[];
  selectedPairId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="rounded-md border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h5 className="text-xs font-semibold text-foreground">Potentially identical pairs</h5>
        <span className="text-[10px] text-muted-foreground">{pairs.length} signal(s)</span>
      </div>
      <ul className="space-y-2">
        {pairs.map((pair) => {
          const active = pair.id === selectedPairId;
          return (
            <li key={pair.id}>
              <button
                type="button"
                onClick={() => onSelect(pair.id)}
                className={`w-full rounded border p-3 text-left transition ${
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background hover:border-primary/60 hover:bg-muted/40"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-foreground">{pair.first.organismDisplay}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {pair.first.accessionNumber} + {pair.second.accessionNumber}
                    </p>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] ${severityClass(pair.severity)}`}>
                    {pair.confidenceLabel}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1 text-[11px] text-muted-foreground">
                  <span>Score {pair.score}</span>
                  <span>{formatDays(pair.daysBetween)}</span>
                  <span>{formatPercent(pair.astSimilarity)} AST</span>
                </div>
                {pair.involvesActiveAccession && (
                  <p className="mt-2 text-[10px] font-medium text-primary">Involves active case</p>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function CandidateDetail({ pair }: { pair: OutbreakCandidatePair }) {
  return (
    <section className="space-y-3 rounded-md border border-border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h5 className="text-sm font-semibold text-foreground">Selected outbreak candidate</h5>
          <p className="text-xs text-muted-foreground">
            Score {pair.score}/100 - {pair.confidenceLabel} - {formatDays(pair.daysBetween)} apart
          </p>
        </div>
        <span className={`rounded-full border px-2 py-1 text-[11px] ${severityClass(pair.severity)}`}>
          {pair.severity.toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <SnapshotCard snapshot={pair.first} />
        <SnapshotCard snapshot={pair.second} />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <EvidenceList title="Why this pair was flagged" items={pair.reasons} />
        <EvidenceList title="Suggested IPC actions" items={pair.recommendedActions} />
      </div>

      <ASTComparison pair={pair} />

      <div className="rounded-md border border-border bg-background p-3">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h6 className="text-xs font-semibold text-foreground">IPC handoff text</h6>
          <span className="text-[10px] text-muted-foreground">Ready to paste into IPC review</span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{pair.ipcHandoff}</p>
      </div>
    </section>
  );
}

function SnapshotCard({ snapshot }: { snapshot: OutbreakIsolateSnapshot }) {
  return (
    <article className="rounded-md border border-border bg-background p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-foreground">{snapshot.patientLabel}</p>
          <p className="text-muted-foreground">{snapshot.accessionNumber}</p>
        </div>
        <button
          type="button"
          onClick={() => meduguActions.setActive(snapshot.accessionId)}
          className="rounded border border-border px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Open case
        </button>
      </div>
      <dl className="mt-2 space-y-1 text-muted-foreground">
        <Row label="Ward" value={snapshot.ward ?? "not recorded"} />
        <Row label="Specimen" value={snapshot.specimenLabel} />
        <Row label="Observed" value={formatDate(snapshot.observedAt)} />
        <Row label="Organism" value={snapshot.organismDisplay} />
        <Row
          label="Phenotype"
          value={snapshot.phenotypeFlags.length > 0 ? snapshot.phenotypeFlags.join("+") : "none inferred"}
        />
      </dl>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[84px_1fr] gap-2">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="break-words text-foreground/80">{value}</dd>
    </div>
  );
}

function EvidenceList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <h6 className="text-xs font-semibold text-foreground">{title}</h6>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function ASTComparison({ pair }: { pair: OutbreakCandidatePair }) {
  const sharedRows = [...pair.matchingAntibiotics, ...pair.discordantAntibiotics].sort();
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h6 className="text-xs font-semibold text-foreground">AST concordance</h6>
        <span className="text-[11px] text-muted-foreground">
          {pair.matchingAntibioticCount}/{pair.sharedAntibioticCount} shared drugs match ({formatPercent(pair.astSimilarity)})
        </span>
      </div>
      {sharedRows.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          No overlapping AST rows are available for this isolate pair.
        </p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="border-b border-border py-1 pr-2">Drug</th>
                <th className="border-b border-border px-2">{pair.first.accessionNumber}</th>
                <th className="border-b border-border px-2">{pair.second.accessionNumber}</th>
                <th className="border-b border-border px-2">Match</th>
              </tr>
            </thead>
            <tbody>
              {sharedRows.map((code) => {
                const firstValue = pair.first.astProfile[code];
                const secondValue = pair.second.astProfile[code];
                const matched = firstValue === secondValue;
                return (
                  <tr key={code}>
                    <td className="border-b border-border/60 py-1 pr-2 font-medium text-foreground">{code}</td>
                    <td className="border-b border-border/60 px-2 text-muted-foreground">{firstValue}</td>
                    <td className="border-b border-border/60 px-2 text-muted-foreground">{secondValue}</td>
                    <td className={matched ? "border-b border-border/60 px-2 text-emerald-600" : "border-b border-border/60 px-2 text-amber-600"}>
                      {matched ? "Yes" : "No"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
