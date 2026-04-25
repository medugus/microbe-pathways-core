import type { Accession } from "../../domain/types";
import type { ValidationReport } from "../../logic/validationEngine";

interface ReleaseGateProps {
  accession: Accession;
  validationReport: ValidationReport;
  consultantName: string;
  consultantReason: string;
  setConsultantName: (value: string) => void;
  setConsultantReason: (value: string) => void;
  onApproveConsultant: () => void;
  onRecordPhoneOut: () => void;
}

export function ReleaseGate({
  accession,
  validationReport,
  consultantName,
  consultantReason,
  setConsultantName,
  setConsultantReason,
  onApproveConsultant,
  onRecordPhoneOut,
}: ReleaseGateProps) {
  return (
    <>
      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-md border border-border bg-card p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Blockers</div>
          <div
            className={`mt-1 text-2xl font-semibold ${validationReport.blockers.length ? "text-destructive" : "text-foreground"}`}
          >
            {validationReport.blockers.length}
          </div>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {validationReport.blockers.slice(0, 6).map((b) => (
              <li key={b.id}>· {b.message}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-md border border-border bg-card p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Phone-out</div>
          <div className="mt-1 text-sm text-foreground">
            {accession.phoneOuts.length === 0 ? "none recorded" : `${accession.phoneOuts.length} event(s)`}
          </div>
          {validationReport.phoneOutRequiredPending && (
            <>
              <p className="mt-1 text-[11px] text-destructive">
                Required for this pathway — release blocked until acknowledged.
              </p>
              <button
                type="button"
                onClick={onRecordPhoneOut}
                className="mt-2 rounded bg-destructive/10 px-2 py-1 text-xs text-destructive hover:bg-destructive/20"
              >
                record acknowledged phone-out
              </button>
            </>
          )}
        </div>

        <div className="rounded-md border border-border bg-card p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Consultant</div>
          {validationReport.consultantReleaseRequired ? (
            accession.release.consultantApproval ? (
              <div className="mt-1 text-xs text-foreground">
                Approved by <span className="font-medium">{accession.release.consultantApproval.approvedBy}</span>
                <div className="text-[10px] text-muted-foreground">
                  {new Date(accession.release.consultantApproval.approvedAt).toLocaleString()}
                </div>
              </div>
            ) : (
              <div className="mt-1 space-y-1.5">
                <p className="text-[11px] text-destructive">Required for {accession.specimen.subtypeCode}.</p>
                <input
                  value={consultantName}
                  onChange={(e) => setConsultantName(e.target.value)}
                  placeholder="Consultant name"
                  className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                />
                <input
                  value={consultantReason}
                  onChange={(e) => setConsultantReason(e.target.value)}
                  placeholder="Reason / note (optional)"
                  className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={onApproveConsultant}
                  disabled={!consultantName.trim()}
                  className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
                >
                  Record consultant approval
                </button>
              </div>
            )
          ) : (
            <div className="mt-1 text-xs text-muted-foreground">Not required.</div>
          )}
        </div>
      </section>

      {validationReport.amsPendingRestrictedCount > 0 && (
        <section className="callout callout-warning text-[11px]">
          <strong>{validationReport.amsPendingRestrictedCount}</strong> restricted antimicrobial row(s) are still hidden
          from the clinician report pending AMS approval. Open the <span className="font-mono">AMS approvals</span>{" "}
          section to request, approve, or deny. Release will proceed but those rows will remain suppressed in the
          released report and exports until approved (a later amendment will be required to surface them).
        </section>
      )}
    </>
  );
}
