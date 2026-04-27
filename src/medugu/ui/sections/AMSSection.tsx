// AMSSection — per-accession AMS restricted-drug approval workspace.
// Browser-phase only: manual actor placeholder, no real notification
// transport, no production SLA enforcement. Workflow logic remains in
// logic/amsEngine.ts + logic/stewardshipEngine.ts.

import { useMemo, useState } from "react";
import { AMS_BROWSER_PHASE_WARNING, AMS_POLICY } from "../../config/amsConfig";
import { AMS_RULES } from "../../config/stewardshipRules";
import { newId } from "../../domain/ids";
import type { AMSApprovalRequest, ASTResult } from "../../domain/types";
import {
  approvalStatusForRow,
  computeDueBy,
  findExpirableRequestIds,
  isRestrictedRow,
} from "../../logic/amsEngine";
import { getRuleForAMSRecommendation } from "../../logic/amsRuleGovernance";
import { resolveSpecimen } from "../../logic/specimenResolver";
import { evaluateAMSRecommendation, evaluateStewardship } from "../../logic/stewardshipEngine";
import { meduguActions, useActiveAccession } from "../../store/useAccessionStore";
import { AMSApprovalQueue } from "./AMSApprovalQueue";
import { AMSRecommendationCard } from "./ams/AMSRecommendationCard";
import { AMSRuleGovernancePanel } from "./ams/AMSRuleGovernancePanel";
import { AMSSummaryStrip } from "./ams/AMSSummaryStrip";

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
  const specimenResolved = resolveSpecimen(
    currentAccession.specimen.familyCode,
    currentAccession.specimen.subtypeCode,
  );
  const syndrome = specimenResolved.ok
    ? (specimenResolved.profile.syndrome ?? undefined)
    : undefined;
  const specimenLabel = specimenResolved.ok ? specimenResolved.profile.displayName : undefined;

  const restrictedRows = currentAccession.ast.filter((r) => isRestrictedRow(r));

  const recommendationRows = useMemo(() => {
    return currentAccession.ast
      .map((row) => {
        const decision = stewardship.byAst[row.id];
        if (!decision) return null;
        const approval = approvalStatusForRow(currentAccession, row.id);
        const recommendation = evaluateAMSRecommendation(
          currentAccession,
          row,
          decision,
          stewardship.byAst,
        );
        const governanceRule = getRuleForAMSRecommendation(recommendation, AMS_RULES);
        const isolate = currentAccession.isolates.find((i) => i.id === row.isolateId);
        return {
          row,
          isolate,
          decision,
          approval,
          recommendation,
          governanceRuleCode:
            governanceRule?.ruleCode ?? recommendation.explanation.matchedRuleCode,
          restriction:
            decision.releaseClass === "restricted"
              ? "locally restricted"
              : "not locally restricted",
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
    restrictedOrReserve: recommendationRows.filter(
      (r) => r.decision.releaseClass === "restricted" || r.decision.aware === "Reserve",
    ).length,
    pendingApproval: recommendationRows.filter((r) => r.approval === "pending").length,
    deEscalation: recommendationRows.filter(
      (r) => r.recommendation.category === "de_escalation_opportunity",
    ).length,
    mismatch: recommendationRows.filter((r) => r.recommendation.category === "bug_drug_mismatch")
      .length,
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

      <AMSRuleGovernancePanel
        linkedRuleCodes={recommendationRows.map((entry) => entry.governanceRuleCode)}
      />

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
        restrictedRows={restrictedRows}
        requestNote={requestNote}
        decisionNote={decisionNote}
        onRequestNoteChange={(rowId, value) => setRequestNote((s) => ({ ...s, [rowId]: value }))}
        onDecisionNoteChange={(requestId, value) =>
          setDecisionNote((s) => ({ ...s, [requestId]: value }))
        }
        onRequest={request}
        onDecide={decide}
      />
    </div>
  );
}
