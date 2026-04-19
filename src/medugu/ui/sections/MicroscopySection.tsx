import { useActiveAccession } from "../../store/useAccessionStore";
import { SectionPlaceholder } from "./_Placeholder";

export function MicroscopySection() {
  const accession = useActiveAccession();
  return (
    <SectionPlaceholder
      title="Microscopy"
      description="Stains, cell counts, organism morphology. Findings list is per accession."
      accession={accession}
    >
      {accession && (
        <p className="mt-3 text-sm text-muted-foreground">
          {accession.microscopy.length} finding(s) recorded.
        </p>
      )}
    </SectionPlaceholder>
  );
}
