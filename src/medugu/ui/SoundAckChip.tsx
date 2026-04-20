// SoundAckChip — tiny header chip that appears whenever there is at least one
// unacknowledged repeating critical alert. Lets the user silence the loop
// without changing any underlying clinical state.
//
// Intentionally redundant with the visible blocker chips — sound is never the
// sole signal.

import { useEffect, useState } from "react";
import { soundEngine, type ActiveAlertSummary } from "../logic/soundEngine";

export function SoundAckChip() {
  const [summary, setSummary] = useState<ActiveAlertSummary>({
    pendingCritical: 0,
    lastCriticalKey: null,
  });

  useEffect(() => soundEngine.subscribe(setSummary), []);

  if (summary.pendingCritical === 0) return null;

  return (
    <button
      type="button"
      onClick={() => soundEngine.acknowledgeAll()}
      className="chip chip-square chip-danger gap-1 text-[11px] font-semibold uppercase"
      title={summary.lastCriticalKey ?? undefined}
      aria-label="Silence repeating critical alert"
    >
      <span aria-hidden="true">🔔</span>
      Silence alert ({summary.pendingCritical})
    </button>
  );
}
