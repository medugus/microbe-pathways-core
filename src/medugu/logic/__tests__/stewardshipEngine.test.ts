import {
  amsAcceptanceScenarioCases,
  deEscalationOpportunityCase,
} from "../../fixtures/amsAcceptanceCases";
import { evaluateAMSRecommendation, evaluateStewardship } from "../stewardshipEngine";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const fixedNow = Date.parse("2026-04-25T12:00:00.000Z");
const originalDateNow = Date.now;
Date.now = () => fixedNow;

const restrictedCase = amsAcceptanceScenarioCases.restrictedMeropenemPendingApprovalCase;
const restrictedDecision = evaluateStewardship(restrictedCase);
const restrictedRow = restrictedCase.ast[0];
const restrictedRecommendation = evaluateAMSRecommendation(
  restrictedCase,
  restrictedRow,
  restrictedDecision.byAst[restrictedRow.id],
  restrictedDecision.byAst,
);
assert(
  restrictedRecommendation.category === "restricted_approval_required"
    || restrictedRecommendation.category === "reserve_review",
  "Restricted/review case should produce approval-required or reserve-review recommendation.",
);
assert(
  /approval/.test(restrictedRecommendation.recommendation.toLowerCase()),
  "Restricted/review recommendation should clearly include approval required wording.",
);
assert(
  restrictedRecommendation.explanation.safetyNote.toLowerCase().includes("no automatic prescribing"),
  "Safety note should explicitly state no automatic prescribing.",
);

const noTherapyCase = amsAcceptanceScenarioCases.noTherapyUnderReviewCase;
const noTherapyDecision = evaluateStewardship(noTherapyCase);
const noTherapyRow = noTherapyCase.ast[0];
const noTherapyRecommendation = evaluateAMSRecommendation(
  noTherapyCase,
  noTherapyRow,
  noTherapyDecision.byAst[noTherapyRow.id],
  noTherapyDecision.byAst,
);
assert(noTherapyRecommendation.category === "insufficient_data", "Missing therapy context should return insufficient_data.");
assert(
  noTherapyRecommendation.recommendation.toLowerCase().includes("insufficient data"),
  "Missing therapy context should provide explicit insufficient data wording.",
);

const deEscalationDecision = evaluateStewardship(deEscalationOpportunityCase);
const deEscalationRow = deEscalationOpportunityCase.ast.find((row) => row.antibioticCode === "MEM");
if (!deEscalationRow) throw new Error("Expected MEM row in de-escalation fixture.");
const deEscalationRecommendation = evaluateAMSRecommendation(
  deEscalationOpportunityCase,
  deEscalationRow,
  deEscalationDecision.byAst[deEscalationRow.id],
  deEscalationDecision.byAst,
);
assert(
  deEscalationRecommendation.category === "de_escalation_opportunity",
  "Narrower active reportable option should produce de-escalation opportunity.",
);
assert(
  /consider|review/i.test(deEscalationRecommendation.recommendation),
  "De-escalation wording should remain cautious (consider/review).",
);
assert(
  !/switch to/i.test(deEscalationRecommendation.recommendation),
  "De-escalation wording should not introduce automatic switch language.",
);

const suppressedNarrowOptionCase = {
  ...deEscalationOpportunityCase,
  ast: deEscalationOpportunityCase.ast.map((row) =>
    row.antibioticCode === "CXM" ? { ...row, cascadeDecision: "suppressed_by_phenotype" as const } : row,
  ),
};
const suppressedDecision = evaluateStewardship(suppressedNarrowOptionCase);
const suppressedMem = suppressedNarrowOptionCase.ast.find((row) => row.antibioticCode === "MEM");
if (!suppressedMem) throw new Error("Expected MEM row in suppressed-option fixture.");
const suppressedRecommendation = evaluateAMSRecommendation(
  suppressedNarrowOptionCase,
  suppressedMem,
  suppressedDecision.byAst[suppressedMem.id],
  suppressedDecision.byAst,
);
assert(
  suppressedRecommendation.category !== "de_escalation_opportunity",
  "Suppressed/non-reportable narrower option must not be recommended for de-escalation.",
);

const highRiskCase = amsAcceptanceScenarioCases.csfHighRiskSyndromeCase;
const highRiskDecision = evaluateStewardship(highRiskCase);
const highRiskMem = highRiskCase.ast.find((row) => row.antibioticCode === "MEM");
if (!highRiskMem) throw new Error("Expected MEM row in high-risk fixture.");
const highRiskRecommendation = evaluateAMSRecommendation(
  highRiskCase,
  highRiskMem,
  highRiskDecision.byAst[highRiskMem.id],
  highRiskDecision.byAst,
);
assert(
  highRiskRecommendation.category !== "de_escalation_opportunity",
  "High-risk CSF/meningitis scenario should not receive simplistic de-escalation guidance.",
);

Date.now = originalDateNow;

// eslint-disable-next-line no-console
console.log("[stewardshipEngine.test] all assertions passed");
