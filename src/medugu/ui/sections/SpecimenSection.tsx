import { useActiveAccession } from "../../store/useAccessionStore";
import { SectionPlaceholder } from "./_Placeholder";

export function SpecimenSection() {
  const accession = useActiveAccession();
  return (
    <SectionPlaceholder
      title="Specimen"
      description="Coded specimen family + subtype drives downstream workflow. Free-text labels are display only."
      accession={accession}
    >
      {accession && (
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <dt className="text-muted-foreground">Family</dt>
          <dd className="font-mono text-foreground">{accession.specimen.familyCode}</dd>
          <dt className="text-muted-foreground">Subtype</dt>
          <dd className="font-mono text-foreground">{accession.specimen.subtypeCode}</dd>
          <dt className="text-muted-foreground">Container</dt>
          <dd className="font-mono text-foreground">{accession.specimen.containerCode ?? "—"}</dd>
          <dt className="text-muted-foreground">Label (display)</dt>
          <dd className="text-foreground">{accession.specimen.freeTextLabel ?? "—"}</dd>
        </dl>
      )}
    </SectionPlaceholder>
  );
}
