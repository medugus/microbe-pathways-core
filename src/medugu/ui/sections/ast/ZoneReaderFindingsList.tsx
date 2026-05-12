import type { ImportFinding } from "../../../integrations/zoneReader/types";

interface Props {
  findings: ImportFinding[];
}

const SEVERITY_STYLE: Record<ImportFinding["severity"], string> = {
  blocker: "border-destructive/40 bg-destructive/10 text-destructive",
  warning: "border-amber-400/40 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200",
  info: "border-border bg-muted/40 text-muted-foreground",
};

const SEVERITY_ORDER: Record<ImportFinding["severity"], number> = {
  blocker: 0,
  warning: 1,
  info: 2,
};

export function ZoneReaderFindingsList({ findings }: Props) {
  if (findings.length === 0) {
    return <p className="text-xs text-muted-foreground">No findings.</p>;
  }
  const sorted = [...findings].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
  return (
    <ul className="space-y-1">
      {sorted.map((f, i) => (
        <li
          key={`${f.code}-${i}`}
          className={`rounded border px-2 py-1 text-xs ${SEVERITY_STYLE[f.severity]}`}
        >
          <span className="font-mono uppercase">[{f.severity}]</span>{" "}
          <span className="font-mono">{f.code}</span>
          {f.antibioticCode ? <span> · {f.antibioticCode}</span> : null} — {f.message}
        </li>
      ))}
    </ul>
  );
}
