import type { TriageBucket } from "../../../ai/triageWorklist.functions";

const STYLES: Record<TriageBucket, string> = {
  auto: "bg-emerald-100 text-emerald-800 border-emerald-300",
  glance: "bg-amber-100 text-amber-800 border-amber-300",
  work: "bg-rose-100 text-rose-800 border-rose-300",
};

const LABELS: Record<TriageBucket, string> = {
  auto: "Auto",
  glance: "Glance",
  work: "Work",
};

export function TriageBucketChip({ bucket, rationale }: { bucket: TriageBucket; rationale?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${STYLES[bucket]}`}
      title={
        rationale
          ? `${rationale}\n\nAI-suggested workload triage, not a clinical decision.`
          : "AI-suggested workload triage, not a clinical decision."
      }
    >
      <span aria-hidden>✨</span>
      {LABELS[bucket]}
    </span>
  );
}
