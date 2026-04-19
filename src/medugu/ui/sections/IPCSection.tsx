import { useActiveAccession } from "../../store/useAccessionStore";
import { SectionPlaceholder } from "./_Placeholder";

export function IPCSection() {
  const accession = useActiveAccession();
  return (
    <SectionPlaceholder
      title="IPC"
      description="Alert organisms, MDRO/XDR/PDR flags, transmission-based precaution signals."
      accession={accession}
    >
      {accession && (
        <p className="mt-3 text-sm text-muted-foreground">
          {accession.ipc.length} IPC signal(s).
        </p>
      )}
    </SectionPlaceholder>
  );
}
