// Thin client-side wrapper around runValidation that prefers the server
// engine when PHASE5_SERVER_VALIDATION is enabled.
//
// Sprint P5-S1 step 3 follow-up. The hook ALWAYS returns the local report
// synchronously so the UI never blocks on the network — it then upgrades to
// the server-authoritative report once `validateAccessionServer` resolves.
//
// Failure modes are explicit, not silent:
//   - flag off on the server  -> source = "client", reason = server message
//   - server error / timeout  -> source = "client-fallback", reason = error
//   - server returns ok=false -> source = "client-fallback", reason = server message
//   - server ok + report      -> source = "server", report swapped
//
// Re-runs whenever the accession's `updatedAt` (a proxy for client version)
// or the resolved postgres row id changes.

import { useEffect, useRef, useState } from "react";
import type { Accession } from "../domain/types";
import { runValidation, type ValidationReport } from "../logic/validationEngine";
import { validateAccessionServer } from "./engines.functions";

export type AuthoritativeValidationSource =
  | "client" // server flag is off — client engine is the contract
  | "server" // server returned an authoritative report
  | "client-fallback"; // server attempt failed — client report shown

export interface AuthoritativeValidation {
  report: ValidationReport;
  source: AuthoritativeValidationSource;
  /** True while a server attempt is in flight. */
  loading: boolean;
  /** Human-readable explanation for why the server report was not used. */
  fallbackReason?: string;
  /** Last time the server was successfully consulted, if ever. */
  lastServerAt?: number;
}

export function useAuthoritativeValidation(
  accession: Accession | null,
  accessionRowId: string | null,
): AuthoritativeValidation {
  // Local report is always computed — it is the safety net.
  const localReport = accession ? runValidation(accession) : EMPTY_REPORT;

  const [serverReport, setServerReport] = useState<ValidationReport | null>(null);
  const [source, setSource] = useState<AuthoritativeValidationSource>("client");
  const [loading, setLoading] = useState(false);
  const [fallbackReason, setFallbackReason] = useState<string | undefined>(undefined);
  const [lastServerAt, setLastServerAt] = useState<number | undefined>(undefined);

  // Cancel-token to avoid races when the active accession switches mid-flight.
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (!accession || !accessionRowId) {
      // No row id ⇒ accession not yet persisted; client engine is the only
      // option. This is not a failure — express it as plain "client".
      setServerReport(null);
      setSource("client");
      setFallbackReason(undefined);
      return;
    }

    const reqId = ++reqIdRef.current;
    setLoading(true);

    void validateAccessionServer({ data: { accessionRowId } })
      .then((res) => {
        if (reqIdRef.current !== reqId) return; // stale
        if (!res.ok) {
          setServerReport(null);
          setSource("client-fallback");
          setFallbackReason(res.reason ?? "Server validation returned ok=false.");
          return;
        }
        if (res.serverAuthoritative && res.report) {
          setServerReport(res.report);
          setSource("server");
          setFallbackReason(undefined);
          setLastServerAt(Date.now());
          return;
        }
        // Flag is off — client engine remains the contract.
        setServerReport(null);
        setSource("client");
        setFallbackReason(res.reason);
      })
      .catch((err: unknown) => {
        if (reqIdRef.current !== reqId) return;
        setServerReport(null);
        setSource("client-fallback");
        setFallbackReason(err instanceof Error ? err.message : "Server validation request failed.");
      })
      .finally(() => {
        if (reqIdRef.current !== reqId) return;
        setLoading(false);
      });
    // accession.updatedAt is bumped on every governed mutation by the store,
    // so it is a reliable trigger for revalidation.
  }, [accession, accession?.updatedAt, accessionRowId]);

  return {
    report: source === "server" && serverReport ? serverReport : localReport,
    source,
    loading,
    fallbackReason,
    lastServerAt,
  };
}

const EMPTY_REPORT: ValidationReport = {
  issues: [],
  blockers: [],
  warnings: [],
  info: [],
  releaseAllowed: false,
  consultantReleaseRequired: false,
  phoneOutRequiredPending: false,
  consultantApprovalPending: false,
  amsPendingRestrictedCount: 0,
};
