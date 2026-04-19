import { useActiveAccession } from "../../store/useAccessionStore";
import { SectionPlaceholder } from "./_Placeholder";

export function StewardshipSection() {
  const accession = useActiveAccession();
  return (
    <SectionPlaceholder
      title="Stewardship"
      description="AMS review: bug-drug mismatch, redundancy, de-escalation, IV→PO."
      accession={accession}
    >
      {accession && (
        <p className="mt-3 text-sm text-muted-foreground">
          {accession.stewardship.length} stewardship note(s).
        </p>
      )}
    </SectionPlaceholder>
  );
}
