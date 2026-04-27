import { DispatchHistoryPanel } from "./DispatchHistoryPanel";
import { ReleaseHistoryPanel } from "./ReleaseHistoryPanel";

interface ReleaseHistoryEmbedProps {
  accessionRowId: string | null;
  historyKey: number;
}

export function ReleaseHistoryEmbed({ accessionRowId, historyKey }: ReleaseHistoryEmbedProps) {
  if (!accessionRowId) return null;

  return (
    <>
      <ReleaseHistoryPanel
        key={`${accessionRowId}-${historyKey}`}
        accessionRowId={accessionRowId}
      />
      <DispatchHistoryPanel
        key={`dispatch-${accessionRowId}-${historyKey}`}
        accessionRowId={accessionRowId}
      />
    </>
  );
}
