import { useActiveAccession } from "../../store/useAccessionStore";
import { SectionPlaceholder } from "./_Placeholder";

export function ValidationSection() {
  const accession = useActiveAccession();
  return (
    <SectionPlaceholder
      title="Validation"
      description="Pre-release rule run. Blocking issues prevent release; warnings require ack."
      accession={accession}
    >
      {accession && (
        <p className="mt-3 text-sm text-muted-foreground">
          {accession.validation.length} validation issue(s).
        </p>
      )}
    </SectionPlaceholder>
  );
}
