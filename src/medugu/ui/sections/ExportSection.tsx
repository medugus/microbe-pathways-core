import { useActiveAccession } from "../../store/useAccessionStore";
import { SectionPlaceholder } from "./_Placeholder";

export function ExportSection() {
  const accession = useActiveAccession();
  return (
    <SectionPlaceholder
      title="Export"
      description="Structured export shapes (JSON, HL7-ish, CSV). Implemented in logic/exporter."
      accession={accession}
    />
  );
}
