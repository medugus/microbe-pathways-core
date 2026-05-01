import type { OperationalQueueItem as QueueItem } from "../../../logic/operationalDashboard";
import type { TriageScored } from "../../../ai/triageWorklist.functions";
import { TriageBucketChip } from "./TriageBucketChip";

const PRIORITY_STYLE: Record<QueueItem["priority"], string> = {
  critical: "bg-destructive text-white",
  high: "bg-destructive/15 text-destructive",
  review: "bg-amber-100 text-amber-800",
  routine: "bg-muted text-muted-foreground",
};

export function OperationalQueueItem({
  item,
  triage,
  onOpen,
}: {
  item: QueueItem;
  triage?: TriageScored;
  onOpen: (item: QueueItem) => void;
}) {
  const openLabel = `Open ${item.accessionNumber ?? item.targetAccessionId} in ${item.targetSection}`;
  return (
    <tr className="hover:bg-muted/40">
      <td className="px-2 py-2 align-top">
        <div className="flex flex-col gap-1">
          <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${PRIORITY_STYLE[item.priority]}`}>
            {item.priority}
          </span>
          {triage && <TriageBucketChip bucket={triage.bucket} rationale={triage.rationale} />}
        </div>
      </td>
      <td className="px-2 py-2 align-top text-xs text-foreground">{item.category.replaceAll("_", " ")}</td>
      <td className="px-2 py-2 align-top text-xs">
        <div className="font-mono text-[11px]">{item.accessionNumber ?? item.accessionId}</div>
        <div className="text-muted-foreground">{item.patientLabel ?? "Unknown patient"}</div>
      </td>
      <td className="px-2 py-2 align-top text-xs text-muted-foreground">
        <div>{item.ward ?? "Ward n/a"}</div>
        <div>{item.specimenLabel ?? "Specimen n/a"}</div>
      </td>
      <td className="px-2 py-2 align-top text-xs text-foreground">{item.organismOrPhenotype ?? "—"}</td>
      <td className="px-2 py-2 align-top text-xs text-foreground">{item.reason}</td>
      <td className="px-2 py-2 align-top text-xs text-foreground">{item.recommendedAction}</td>
      <td className="px-2 py-2 align-top text-xs text-muted-foreground">{item.ownerRole.replaceAll("_", " ")}</td>
      <td className="px-2 py-2 align-top text-xs text-muted-foreground">{item.sourceModule}</td>
      <td className="px-2 py-2 align-top text-xs">
        <span className="rounded border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-foreground">
          {item.targetSection}
        </span>
      </td>
      <td className="px-2 py-2 align-top text-xs">
        <button
          type="button"
          onClick={() => onOpen(item)}
          className="rounded border border-border px-2 py-1 text-[11px] text-foreground hover:bg-muted"
          aria-label={openLabel}
        >
          {openLabel}
        </button>
      </td>
    </tr>
  );
}
