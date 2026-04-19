import { useActiveAccession } from "../../store/useAccessionStore";
import { SectionPlaceholder } from "./_Placeholder";

export function ReportSection() {
  const accession = useActiveAccession();
  return (
    <SectionPlaceholder
      title="Report"
      description="Structured report preview built by logic/reportBuilder from the accession aggregate."
      accession={accession}
    />
  );
}
