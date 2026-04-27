import { useActiveAccession } from "../../store/useAccessionStore";
import { MicroHistoryPanel } from "./MicroHistoryPanel";

export function PatientSection() {
  const accession = useActiveAccession();

  if (!accession) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No active accession. Select or create one in the case manager.
      </div>
    );
  }

  const { patient } = accession;

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold text-foreground">Patient</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Demographics, encounter, and ward context.
        </p>
      </header>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="MRN" value={patient.mrn} mono />
          <Field label="Name" value={`${patient.givenName} ${patient.familyName}`} />
          <Field label="Sex" value={patient.sex} capitalize />
          <Field label="Ward / Location" value={patient.ward ?? "—"} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Accession" value={accession.id} mono />
          <Field label="Stage" value={accession.stage.replace(/_/g, " ")} capitalize />
          <Field label="Priority" value={accession.priority} capitalize />
          <Field
            label="Release state"
            value={accession.release.state.replace(/_/g, " ")}
            capitalize
          />
        </div>
      </div>

      <MicroHistoryPanel />
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  capitalize,
}: {
  label: string;
  value: string;
  mono?: boolean;
  capitalize?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd
        className={
          "mt-0.5 text-sm text-foreground" +
          (mono ? " font-mono" : "") +
          (capitalize ? " capitalize" : "")
        }
      >
        {value}
      </dd>
    </div>
  );
}
