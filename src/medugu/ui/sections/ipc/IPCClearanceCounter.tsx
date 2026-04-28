interface IPCClearanceCounterProps {
  count?: number;
  required?: number;
}

export function IPCClearanceCounter({ count, required }: IPCClearanceCounterProps) {
  const safeCount = count ?? 0;
  const safeRequired = required ?? 3;
  const isComplete = safeCount >= safeRequired;

  return (
    <div className="rounded border border-border/70 bg-background px-2 py-1 text-xs text-muted-foreground">
      Clearance counter: <span className="font-medium text-foreground">{safeCount}/{safeRequired}</span>{" "}
      negative screens {isComplete ? "(threshold met in browser-local lookback)" : "(threshold not yet met)"}
    </div>
  );
}
