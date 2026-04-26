import { amsAcceptanceScenarioCases } from "../../fixtures/amsAcceptanceCases";
import { evaluateAMSRecommendation, evaluateStewardship } from "../stewardshipEngine";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const fixedNow = Date.parse("2026-04-25T12:00:00.000Z");
const originalDateNow = Date.now;
Date.now = () => fixedNow;

const resistantCase = amsAcceptanceScenarioCases.ceftriaxoneResistantUnderReviewCase;
const resistantDecision = evaluateStewardship(resistantCase);
const resistantRow = resistantCase.ast[0];
const resistantRecommendation = evaluateAMSRecommendation(
  resistantCase,
  resistantRow,
  resistantDecision.byAst[resistantRow.id],
  resistantDecision.byAst,
);

assert(
  resistantRecommendation.category === "bug_drug_mismatch",
  "Resistant therapy-under-review case should trigger bug_drug_mismatch category.",
);
assert(
  resistantRecommendation.explanation.matchedRuleCode === "AMS_BUG_DRUG_R",
  "Resistant therapy-under-review case should map to AMS_BUG_DRUG_R.",
);
assert(
  resistantRecommendation.recommendation.toLowerCase().includes("review therapy"),
  "Mismatch recommendation should ask to review therapy rather than apply automatic change.",
);
assert(
  !/switch|prescrib/i.test(resistantRecommendation.recommendation),
  "Mismatch recommendation text should avoid prescribing/switch-automatically wording.",
);

const accessCase = amsAcceptanceScenarioCases.accessAntibioticActiveUnrestrictedCase;
const accessDecision = evaluateStewardship(accessCase);
const accessRow = accessCase.ast[0];
const accessRecommendation = evaluateAMSRecommendation(
  accessCase,
  accessRow,
  accessDecision.byAst[accessRow.id],
  accessDecision.byAst,
);
assert(
  accessRecommendation.category === "continue_or_no_action",
  "Access active unrestricted scenario should remain continue_or_no_action under current convention.",
);
assert(
  accessRecommendation.explanation.safetyNote.toLowerCase().includes("no automatic prescribing"),
  "Access scenario should preserve safety note forbidding automatic prescribing.",
);

Date.now = originalDateNow;

// eslint-disable-next-line no-console
console.log("[amsBugDrugReview.test] all assertions passed");
