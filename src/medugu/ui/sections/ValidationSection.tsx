// ValidationSection — surfaces blockers, warnings, and release readiness.

import { useActiveAccession } from "../../store/useAccessionStore";
import { runValidation } from "../../logic/validationEngine";

export function ValidationSection() {
  const accession = useActiveAccession();
  if (!accession) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No active accession.
      </div>
    );
  }

  const v = runValidation(accession);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className={`rounded px-2 py-1 ${
            v.releaseAllowed
              ? "bg-secondary text-secondary-foreground"
              : "bg-destructive/15 text-destructive"
          }`}
        >
          {v.releaseAllowed ? "Release allowed" : "Release blocked"}
        </span>
        <span className="rounded bg-muted px-2 py-1 text-muted-foreground">
          {v.blockers.length} blocker(s)
        </span>
        <span className="rounded bg-muted px-2 py-1 text-muted-foreground">
          {v.warnings.length} warning(s)
        </span>
        {v.consultantReleaseRequired && (
          <span
            className={`rounded px-2 py-1 ${
              v.consultantApprovalPending
                ? "chip chip-square chip-danger"
                : "chip chip-square chip-success"
            }`}
          >
            consultant {v.consultantApprovalPending ? "approval pending" : "approved"}
          </span>
        )}
        {v.phoneOutRequiredPending && (
          <span className="chip chip-square chip-danger">phone-out required (blocking)</span>
        )}
        {v.amsPendingRestrictedCount > 0 && (
          <span className="chip chip-square chip-ams-pending">
            {v.amsPendingRestrictedCount} AMS approval(s) pending
          </span>
        )}
      </div>

      {(["block", "warn", "info"] as const).map((sev) => {
        const list = v.issues.filter((i) => i.severity === sev);
        if (list.length === 0) return null;
        return (
          <section key={sev}>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {sev === "block" ? "Blockers" : sev === "warn" ? "Warnings" : "Information"}
            </h4>
            <ul className="space-y-1.5">
              {list.map((i) => (
                <li
                  key={i.id}
                  className={`rounded-md border px-3 py-2 text-sm ${
                    sev === "block"
                      ? "border-destructive/30 bg-destructive/10 text-destructive"
                      : sev === "warn"
                        ? "border-border bg-muted text-foreground"
                        : "border-border bg-background text-muted-foreground"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span>{i.message}</span>
                    <code className="text-[10px] opacity-70">
                      {i.section} · {i.code}
                    </code>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {v.issues.length === 0 && (
        <p className="text-sm text-muted-foreground">No validation issues — accession is clean.</p>
      )}
    </div>
  );
}
