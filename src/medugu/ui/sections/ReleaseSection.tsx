import { useActiveAccession } from "../../store/useAccessionStore";
import { SectionPlaceholder } from "./_Placeholder";

export function ReleaseSection() {
  const accession = useActiveAccession();
  return (
    <SectionPlaceholder
      title="Release"
      description="State machine: draft → pending validation → validated → released (with amendment path)."
      accession={accession}
    >
      {accession && (
        <p className="mt-3 text-sm text-muted-foreground">
          State: <span className="font-mono text-foreground">{accession.release.state}</span> · v
          {accession.release.reportVersion}
        </p>
      )}
    </SectionPlaceholder>
  );
}
