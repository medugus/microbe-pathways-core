import type { Accession } from "../../domain/types";
import { ReleaseState } from "../../domain/enums";
import type { ValidationReport } from "../../logic/validationEngine";
import type { AutoDispatchResult } from "../../store/export.functions";

interface ReleaseSealPanelProps {
  accession: Accession;
  validationReport: ValidationReport;
  sealing: boolean;
  sealError: string | null;
  autoDispatch: AutoDispatchResult[] | null;
  onRelease: () => void;
}

export function ReleaseSealPanel({
  accession,
  validationReport,
  sealing,
  sealError,
  autoDispatch,
  onRelease,
}: ReleaseSealPanelProps) {
  const released =
    accession.release.state === ReleaseState.Released ||
    accession.release.state === ReleaseState.Amended;
  const amended = accession.release.state === ReleaseState.Amended;

  return (
    <>
      <section className="rounded-md border border-border bg-background p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground">Release state</div>
            <div className="font-mono text-sm text-foreground">
              {accession.release.state} · v{accession.release.reportVersion}
            </div>
            {accession.releasedAt && (
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                released by {accession.releasingActor} @ {new Date(accession.releasedAt).toLocaleString()}
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={!validationReport.releaseAllowed || released || sealing}
            onClick={onRelease}
            className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {amended
              ? `Amended · v${accession.release.reportVersion}`
              : released
                ? "Released"
                : sealing
                  ? "Sealing on server…"
                  : validationReport.releaseAllowed
                    ? "Release report"
                    : "Release blocked"}
          </button>
        </div>
        {sealError && <p className="mt-2 text-[11px] text-destructive">Server rejected release: {sealError}</p>}
        {!validationReport.releaseAllowed && !released && (
          <ul className="mt-2 space-y-1 text-[11px] text-destructive">
            {validationReport.blockers.map((b) => (
              <li key={b.id}>· {b.message}</li>
            ))}
          </ul>
        )}
      </section>

      {autoDispatch !== null && (
        <section className="rounded-md border border-border bg-background p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Auto-dispatch on release
          </h4>
          {autoDispatch.length === 0 ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              No enabled receivers configured for this tenant — nothing to dispatch. Configure receivers in
              /admin/receivers.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {autoDispatch.map((d) => (
                <li key={d.receiverId} className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                      d.ok ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {d.ok ? "OK" : "FAIL"}
                  </span>
                  <span className="font-medium text-foreground">{d.receiverName}</span>
                  <span className="text-muted-foreground">[{d.format}]</span>
                  {d.httpStatus !== undefined && <span className="text-muted-foreground">HTTP {d.httpStatus}</span>}
                  {!d.ok && d.reason && <span className="text-destructive">— {d.reason}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {accession.releasePackage && (
        <section>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Frozen release package
          </h4>
          <pre className="overflow-auto rounded-md bg-muted p-3 font-mono text-[11px] text-foreground">
            {JSON.stringify(
              {
                builtAt: accession.releasePackage.builtAt,
                version: accession.releasePackage.version,
                ruleVersion: accession.releasePackage.ruleVersion,
                breakpointVersion: accession.releasePackage.breakpointVersion,
                exportVersion: accession.releasePackage.exportVersion,
                buildVersion: accession.releasePackage.buildVersion,
                sealHash: accession.release.sealHash,
              },
              null,
              2,
            )}
          </pre>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Snapshot is immutable; the SHA-256 seal is server-issued and stored in the append-only release_packages
            table.
          </p>
        </section>
      )}
    </>
  );
}
