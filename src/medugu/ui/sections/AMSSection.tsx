// AMSSection — per-accession AMS restricted-drug approval workspace.
// Browser-phase only: manual actor placeholder, no real notification
// transport, no production SLA enforcement. Workflow logic remains in
// logic/amsEngine.ts + logic/stewardshipEngine.ts.

import { useMemo, useState } from "react";
import { AMS_BROWSER_PHASE_WARNING, AMS_POLICY } from "../../config/amsConfig";
import { newId } from "../../domain/ids";
import type { AMSApprovalRequest, ASTResult } from "../../domain/types";
import { approvalStatusForRow, computeDueBy, findExpirableRequestIds, isRestrictedRow } from "../../logic/amsEngine";
import { resolveSpecimen } from "../../logic/specimenResolver";
import { evaluateStewardship } from "../../logic/stewardshipEngine";
import { meduguActions, useActiveAccession } from "../../store/useAccessionStore";
import { AMSApprovalQueue } from "./AMSApprovalQueue";
import { AMSRecommendationCard, type RecommendationCategory } from "./ams/AMSRecommendationCard";
import { AMSSummaryStrip } from "./ams/AMSSummaryStrip";

function classifyRecommendation(
  row: ASTResult,
  approvalState: string,
  releaseVisible: boolean,
  hasAdvisory: boolean,
): { category: RecommendationCategory; text: string; reason: string } {
  const interpretation = row.finalInterpretation ?? row.interpretedSIR;
  if (!interpretation) {
    return {
      category: "insufficient data",
      text: "Insufficient data — review once AST interpretation is available.",
      reason: "No final AST interpretation is present.",
    };
  }
  if (!releaseVisible) {
    if (approvalState === "approved") {
      return {
        category: "suppress/reporting restricted",
        text: "Recommendation: review withholding condition before release.",
        reason: row.cascadeDecision ?? "Governance or stewardship withholding condition.",
      };
    }
    return {
      category: "request approval",
      text: "Approval required before clinician-facing release.",
      reason: `Current approval state: ${approvalState.replace("_", " ")}.`,
    };
  }
  if (interpretation === "R" || interpretation === "I") {
    return {
      category: "escalate/review",
      text: "Recommend stewardship review for resistance/increased-exposure profile.",
      reason: `AST interpretation is ${interpretation}.`,
    };
  }
  if (hasAdvisory) {
    return {
      category: "de-escalate",
      text: "Consider de-escalation or narrower-option review.",
      reason: "Stewardship advisory is present.",
    };
  }
  if (approvalState === "approved") {
    return {
      category: "approve",
      text: "Approval already recorded; continue with stewardship-aware reporting.",
      reason: "Restricted row is approved.",
    };
  }
  return {
    category: "continue",
    text: "Continue current stewardship review pathway.",
    reason: "No blocking restriction or escalation signal detected.",
  };
}

export function AMSSection() {
  const accession = useActiveAccession();
  const [actor, setActor] = useState("AMS pharmacist");
  const [requestNote, setRequestNote] = useState<Record<string, string>>({});
  const [decisionNote, setDecisionNote] = useState<Record<string, string>>({});

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
        const recommendation = classifyRecommendation(
          row,
          approval,
          decision.visibleToClinician,
          Boolean(decision.advisory),
        );
        const isolate = currentAccession.isolates.find((i) => i.id === row.isolateId);
        return {
          row,
          isolate,
          decision,
          approval,
          recommendation,
          restriction: decision.releaseClass === "restricted" ? "locally restricted" : "not locally restricted",
          releaseImpact: decision.visibleToClinician
            ? "No clinician release block"
            : `Clinician report withheld${decision.suppressionReason ? `: ${decision.suppressionReason}` : ""}`,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .filter((item) => {
        const interpretation = item.row.finalInterpretation ?? item.row.interpretedSIR;
        return (
          item.decision.approvalRequired ||
          item.decision.aware === "Reserve" ||
          item.decision.releaseClass === "restricted" ||
          item.recommendation.category !== "continue" ||
          interpretation === "R" ||
          interpretation === "I"
        );
      });
  }, [currentAccession, stewardship.byAst]);

  const summary = {
    reviewItems: recommendationRows.length,
    restrictedOrReserve: recommendationRows.filter((r) => r.decision.releaseClass === "restricted" || r.decision.aware === "Reserve").length,
    pendingApproval: recommendationRows.filter((r) => r.approval === "pending").length,
    deEscalation: recommendationRows.filter((r) => r.recommendation.category === "de-escalate").length,
    mismatch: stewardship.notes.filter((n) => n.flag === "bug_drug_mismatch").length,
    withheld: recommendationRows.filter((r) => !r.decision.visibleToClinician).length,
  };

  function request(row: ASTResult) {
    const at = new Date().toISOString();
    const req: AMSApprovalRequest = {
      id: newId("ams"),
      astId: row.id,
      isolateId: row.isolateId,
      antibioticCode: row.antibioticCode,
      status: "pending",
      dueBy: computeDueBy(row.antibioticCode, at),
      requested: { at, actor, note: requestNote[row.id]?.trim() || undefined },
    };
    meduguActions.requestAMSApproval(currentAccession.id, req, actor);
    setRequestNote((s) => ({ ...s, [row.id]: "" }));
  }

  function decide(reqId: string, status: "approved" | "denied") {
    meduguActions.decideAMSApproval(currentAccession.id, reqId, {
      status,
      actor,
      note: decisionNote[reqId]?.trim() || undefined,
    });
    setDecisionNote((s) => ({ ...s, [reqId]: "" }));
  }

  function expirePending() {
    const ids = findExpirableRequestIds(currentAccession);
    for (const id of ids) meduguActions.expireAMSApproval(currentAccession.id, id, actor);
  }

  return (
    <div className="space-y-4">
      <div className="callout callout-warning text-[11px]">{AMS_BROWSER_PHASE_WARNING}</div>

      <AMSSummaryStrip counts={summary} />

      <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-background p-3">
        <label className="text-xs">
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
            Actor (placeholder)
          </span>
          <input
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            className="mt-1 w-56 rounded border border-border bg-card px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={expirePending}
          className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted"
        >
          Expire overdue requests
        </button>
        <span className="text-[11px] text-muted-foreground">
          SLA: {AMS_POLICY.defaultSlaHours}h (Watch) · {AMS_POLICY.reserveSlaHours}h (Reserve)
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
              recommendationText={entry.recommendation.text}
              reason={entry.recommendation.reason}
              releaseImpact={entry.releaseImpact}
            />
          ))}
        </div>
      )}

      <AMSApprovalQueue
        accession={currentAccession}
        restrictedRows={restrictedRows}
        requestNote={requestNote}
        decisionNote={decisionNote}
        onRequestNoteChange={(rowId, value) => setRequestNote((s) => ({ ...s, [rowId]: value }))}
        onDecisionNoteChange={(requestId, value) => setDecisionNote((s) => ({ ...s, [requestId]: value }))}
        onRequest={request}
        onDecide={decide}
      />
    </div>
  );
}
