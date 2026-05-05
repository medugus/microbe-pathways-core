// Structured denial-reason catalog for the AMS approval workflow.
// Codes drive audit trails and downstream analytics; UI labels are human
// strings only.

import type { AMSDenialReasonCode } from "../domain/types";

export interface AMSDenialReason {
  code: AMSDenialReasonCode;
  label: string;
  description: string;
}

export const AMS_DENIAL_REASONS: readonly AMSDenialReason[] = [
  {
    code: "no_clinical_indication",
    label: "No clinical indication",
    description: "Documented infection / syndrome does not warrant the requested agent.",
  },
  {
    code: "alternative_available",
    label: "Narrower alternative available",
    description: "A non-restricted, equally effective option is available per local guideline.",
  },
  {
    code: "duration_exceeds_policy",
    label: "Duration exceeds policy",
    description: "Requested course length exceeds the stewardship policy ceiling.",
  },
  {
    code: "insufficient_justification",
    label: "Insufficient justification",
    description: "Request does not include enough clinical detail to authorise.",
  },
  {
    code: "duplicate_therapy",
    label: "Duplicate / overlapping therapy",
    description: "Patient is already receiving an agent with the same spectrum.",
  },
  {
    code: "awaiting_culture",
    label: "Awaiting culture / susceptibility",
    description: "De-escalation pending; review when AST result is available.",
  },
  {
    code: "other",
    label: "Other (see note)",
    description: "Free-text reason captured in the decision note.",
  },
] as const;

export function getDenialReason(code: AMSDenialReasonCode | undefined) {
  if (!code) return undefined;
  return AMS_DENIAL_REASONS.find((r) => r.code === code);
}
