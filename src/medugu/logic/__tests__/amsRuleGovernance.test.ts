import { AMS_RULES } from "../../config/stewardshipRules";
import {
  getAMSRuleGovernanceSummary,
  getRuleForAMSRecommendation,
} from "../amsRuleGovernance";
import type { AMSRecommendationResult } from "../stewardshipEngine";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const fixedNow = Date.parse("2026-04-25T12:00:00.000Z");
const originalDateNow = Date.now;
Date.now = () => fixedNow;

const summary = getAMSRuleGovernanceSummary(AMS_RULES);
assert(summary.totalRules === AMS_RULES.length, "Governance summary should count all AMS rules.");
assert(
  summary.rulesWithoutRationale === AMS_RULES.filter((rule) => !rule.rationale?.trim()).length,
  "Governance summary should flag rules missing rationale.",
);
assert(
  summary.rulesWithoutSource === AMS_RULES.filter((rule) => !rule.sourceLabel?.trim()).length,
  "Governance summary should flag rules missing source.",
);
assert(
  summary.limitationNote.toLowerCase().includes("production editing requires backend audit and permissions"),
  "Governance panel summary should explicitly communicate read-only browser-phase limitations.",
);

const linkedRecommendation: Pick<AMSRecommendationResult, "explanation"> = {
  explanation: {
    matchedRuleCode: "AMS_RESTRICTED_APPROVAL",
    antibioticUnderReview: "MEM",
    awareCategory: "Watch",
    restrictionStatus: "approval required",
    astInterpretation: "S",
    organismContext: "Klebsiella pneumoniae",
    specimenOrSyndromeContext: "Blood",
    reportabilityGovernanceState: "interpreted · withheld · approval pending",
    missingData: [],
    safetyNote: "Stewardship decision support only",
  },
};
const matchedRule = getRuleForAMSRecommendation(linkedRecommendation, AMS_RULES);
assert(
  matchedRule?.ruleCode === "AMS_RESTRICTED_APPROVAL",
  "getRuleForAMSRecommendation should map matched recommendation codes to configured governance rules.",
);

const unlinkedRecommendation: Pick<AMSRecommendationResult, "explanation"> = {
  explanation: {
    ...linkedRecommendation.explanation,
    matchedRuleCode: "AMS_UNKNOWN_RULE",
  },
};
assert(
  getRuleForAMSRecommendation(unlinkedRecommendation, AMS_RULES) === undefined,
  "Unknown recommendation rule code should not be force-mapped.",
);

Date.now = originalDateNow;

// eslint-disable-next-line no-console
console.log("[amsRuleGovernance.test] all assertions passed");
