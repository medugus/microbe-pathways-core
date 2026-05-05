// AMSSection — per-accession AMS restricted-drug approval workspace.
//
// Real workflow (no longer a visibility flag):
//   - Actor identity comes from the signed-in profile + tenant role
//     (lab_tech/microbiologist may file requests; ams_pharmacist/consultant/
//     admin may approve or deny). Buttons are role-gated.
//   - Requests require a non-empty clinical justification.
//   - Denials require a structured denial reason code.
//   - Pending requests past dueBy auto-escalate; past 48h grace they expire.
//   - Every action is written to the durable, tenant-scoped audit_event table
//     via the store's appendAudit pipeline, with auth.uid() attached.

import { useEffect, useMemo, useState } from "react";
import { AMS_POLICY } from "../../config/amsConfig";
import { AMS_RULES } from "../../config/stewardshipRules";
import { newId } from "../../domain/ids";
import type { AMSApprovalRequest, AMSDenialReasonCode, ASTResult } from "../../domain/types";
import {
  approvalStatusForRow,
  computeDueBy,
  isRestrictedRow,
} from "../../logic/amsEngine";
import { getRuleForAMSRecommendation } from "../../logic/amsRuleGovernance";
import { resolveSpecimen } from "../../logic/specimenResolver";
import { evaluateAMSRecommendation, evaluateStewardship } from "../../logic/stewardshipEngine";
import { meduguActions, useActiveAccession } from "../../store/useAccessionStore";
import { useAccessionRowId } from "../../store/useAccessionRowId";
import { useAMSActor } from "../../store/useAMSActor";
import { AMSApprovalQueue } from "./AMSApprovalQueue";
import { AMSRecommendationCard } from "./ams/AMSRecommendationCard";
import { AMSRuleGovernancePanel } from "./ams/AMSRuleGovernancePanel";
import { AMSSummaryStrip } from "./ams/AMSSummaryStrip";

export function AMSSection() {
  const accession = useActiveAccession();
  const accessionRowId = useAccessionRowId(accession?.accessionNumber ?? null);
  const actor = useAMSActor();
  const [requestNote, setRequestNote] = useState<Record<string, string>>({});
  const [decisionNote, setDecisionNote] = useState<Record<string, string>>({});
  const [denialCode, setDenialCode] = useState<Record<string, AMSDenialReasonCode>>({});

  // Sweep SLAs once per mount so escalations and expirations show up
  // when the workspace is opened.
  useEffect(() => {
    meduguActions.sweepAMSSlas(actor.label);
  }, [actor.label]);

  if (!accession) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No active accession.
      </div>
    );
  }

  const currentAccession = accession;
  const stewardship = evaluateStewardship(currentAccession);
  const specimenResolved = resolveSpecimen(currentAccession.specimen.familyCode, currentAccession.specimen.subtypeCode);
  const syndrome = specimenResolved.ok ? specimenResolved.profile.syndrome ?? undefined : undefined;
  const specimenLabel = specimenResolved.ok ? specimenResolved.profile.displayName : undefined;

  const restrictedRows = currentAccession.ast.filter((r) => isRestrictedRow(r));

  const recommendationRows = useMemo(() => {
    return currentAccession.ast
      .map((row) => {
        const decision = stewardship.byAst[row.id];
        if (!decision) return null;
        const approval = approvalStatusForRow(currentAccession, row.id);
        const recommendation = evaluateAMSRecommendation(currentAccession, row, decision, stewardship.byAst);
        const governanceRule = getRuleForAMSRecommendation(recommendation, AMS_RULES);
        const isolate = currentAccession.isolates.find((i) => i.id === row.isolateId);
        return {
          row,
          isolate,
          decision,
          approval,
          recommendation,
          governanceRuleCode: governanceRule?.ruleCode ?? recommendation.explanation.matchedRuleCode,
          restriction: decision.releaseClass === "restricted" ? "locally restricted" : "not locally restricted",
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .filter((item) => {
        const interpretation = item.row.finalInterpretation ?? item.row.interpretedSIR;
        return (
          item.decision.approvalRequired ||
          item.decision.aware === "Reserve" ||
          item.decision.releaseClass === "restricted" ||
          item.recommendation.category !== "continue_or_no_action" ||
          interpretation === "R" ||
          interpretation === "I"
        );
      });
  }, [currentAccession, stewardship.byAst]);

  const summary = {
    reviewItems: recommendationRows.length,
    restrictedOrReserve: recommendationRows.filter((r) => r.decision.releaseClass === "restricted" || r.decision.aware === "Reserve").length,
    pendingApproval: recommendationRows.filter((r) => r.approval === "pending").length,
    deEscalation: recommendationRows.filter((r) => r.recommendation.category === "de_escalation_opportunity").length,
    mismatch: recommendationRows.filter((r) => r.recommendation.category === "bug_drug_mismatch").length,
    withheld: recommendationRows.filter((r) => !r.decision.visibleToClinician).length,
  };

  function request(row: ASTResult) {
    const justification = (requestNote[row.id] ?? "").trim();
    if (!justification) return; // guarded in store too
    const at = new Date().toISOString();
    const req: AMSApprovalRequest = {
      id: newId("ams"),
      astId: row.id,
      isolateId: row.isolateId,
      antibioticCode: row.antibioticCode,
      status: "pending",
      dueBy: computeDueBy(row.antibioticCode, at),
      clinicalJustification: justification,
      requested: {
        at,
        actor: actor.label,
        actorUserId: actor.userId ?? undefined,
        actorRole: actor.role ?? undefined,
        note: justification,
      },
    };
    meduguActions.requestAMSApproval(currentAccession.id, req, actor.label);
    setRequestNote((s) => ({ ...s, [row.id]: "" }));
  }

  function decide(reqId: string, status: "approved" | "denied") {
    if (status === "denied" && !denialCode[reqId]) return;
    meduguActions.decideAMSApproval(currentAccession.id, reqId, {
      status,
      actor: actor.label,
      actorUserId: actor.userId,
      actorRole: actor.role,
      note: decisionNote[reqId]?.trim() || undefined,
      denialReasonCode: status === "denied" ? denialCode[reqId] : undefined,
    });
    setDecisionNote((s) => ({ ...s, [reqId]: "" }));
    setDenialCode((s) => {
      const next = { ...s };
      delete next[reqId];
      return next;
    });
  }

  function runSweep() {
    meduguActions.sweepAMSSlas(actor.label);
  }

  return (
    <div className="space-y-4">
      <AMSSummaryStrip counts={summary} />

      <AMSRuleGovernancePanel linkedRuleCodes={recommendationRows.map((entry) => entry.governanceRuleCode)} />

      <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-background p-3 text-xs">
        <span className="text-muted-foreground uppercase tracking-wide text-[10px]">
          Approver identity
        </span>
        <span className="font-medium text-foreground">{actor.label}</span>
        {actor.role ? (
          <span className="chip chip-square chip-neutral">{actor.role}</span>
        ) : (
          <span className="chip chip-square chip-warning">no tenant role</span>
        )}
        {actor.canApprove ? (
          <span className="chip chip-square chip-success">may approve</span>
        ) : (
          <span className="chip chip-square chip-neutral">read-only</span>
        )}
        <button
          type="button"
          onClick={runSweep}
          className="ml-auto rounded border border-border px-3 py-1.5 hover:bg-muted"
        >
          Run SLA sweep
        </button>
        <span className="text-[11px] text-muted-foreground">
          SLA: {AMS_POLICY.defaultSlaHours}h (Watch) · {AMS_POLICY.reserveSlaHours}h (Reserve) · {AMS_POLICY.expiryGraceHours}h grace
        </span>
      </div>

      {recommendationRows.length === 0 ? (
        <div className="rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">
          No AMS actions.
        </div>
      ) : (
        <div className="space-y-3">
          {recommendationRows.map((entry) => (
            <AMSRecommendationCard
              key={entry.row.id}
              row={entry.row}
              isolate={entry.isolate}
              specimenLabel={specimenLabel}
              syndrome={syndrome}
              decision={entry.decision}
              approvalStatus={entry.approval}
              restriction={entry.restriction}
              recommendationCategory={entry.recommendation.category}
              recommendationText={entry.recommendation.recommendation}
              reason={entry.recommendation.reason}
              releaseImpact={entry.recommendation.releaseImpact}
              explanation={entry.recommendation.explanation}
              governanceRuleCode={entry.governanceRuleCode}
            />
          ))}
        </div>
      )}

      <AMSApprovalQueue
        accession={currentAccession}
        accessionRowId={accessionRowId}
        restrictedRows={restrictedRows}
        requestNote={requestNote}
        decisionNote={decisionNote}
        denialCode={denialCode}
        canRequest={actor.canRequest}
        canApprove={actor.canApprove}
        onRequestNoteChange={(rowId, value) => setRequestNote((s) => ({ ...s, [rowId]: value }))}
        onDecisionNoteChange={(requestId, value) => setDecisionNote((s) => ({ ...s, [requestId]: value }))}
        onDenialCodeChange={(requestId, value) =>
          setDenialCode((s) => ({ ...s, [requestId]: value }))
        }
        onRequest={request}
        onDecide={decide}
      />
    </div>
  );
}
