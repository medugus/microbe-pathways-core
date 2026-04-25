export type OperationalQueueFilter = "all" | "ipc" | "ams" | "release" | "validation" | "critical";

const FILTER_LABELS: Record<OperationalQueueFilter, string> = {
  all: "All",
  ipc: "IPC",
  ams: "AMS",
  release: "Release",
  validation: "Validation",
  critical: "Critical",
};

export function OperationalFilters({
  filter,
  onChange,
}: {
  filter: OperationalQueueFilter;
  onChange: (next: OperationalQueueFilter) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {(Object.keys(FILTER_LABELS) as OperationalQueueFilter[]).map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`rounded border px-2 py-1 text-xs ${
            filter === key
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:bg-muted"
          }`}
        >
          {FILTER_LABELS[key]}
        </button>
      ))}
    </div>
  );
}
