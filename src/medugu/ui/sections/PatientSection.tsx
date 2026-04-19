import { useActiveAccession } from "../../store/useAccessionStore";
import { SectionPlaceholder } from "./_Placeholder";

export function PatientSection() {
  const accession = useActiveAccession();
  return (
    <SectionPlaceholder
      title="Patient"
      description="Demographics, encounter, and ward context. Read-only mirror of LIS in later phases."
      accession={accession}
    >
      {accession && (
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <dt className="text-muted-foreground">MRN</dt>
          <dd className="font-mono text-foreground">{accession.patient.mrn}</dd>
          <dt className="text-muted-foreground">Name</dt>
          <dd className="text-foreground">
            {accession.patient.givenName} {accession.patient.familyName}
          </dd>
          <dt className="text-muted-foreground">Sex</dt>
          <dd className="text-foreground">{accession.patient.sex}</dd>
          <dt className="text-muted-foreground">Ward</dt>
          <dd className="text-foreground">{accession.patient.ward ?? "—"}</dd>
        </dl>
      )}
    </SectionPlaceholder>
  );
}
