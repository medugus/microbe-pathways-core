import { useActiveAccession } from "../../store/useAccessionStore";
import { SectionPlaceholder } from "./_Placeholder";

export function IsolateSection() {
  const accession = useActiveAccession();
  return (
    <SectionPlaceholder
      title="Isolate"
      description="Coded organism per isolate. Drives AST, stewardship, and IPC engines."
      accession={accession}
    >
      {accession && (
        <p className="mt-3 text-sm text-muted-foreground">
          {accession.isolates.length} isolate(s) on this accession.
        </p>
      )}
    </SectionPlaceholder>
  );
}
