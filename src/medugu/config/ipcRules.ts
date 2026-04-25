// IPC rule configuration. Pure data; consumed by ipcEngine.

export type IPCAction =
  | "contact_precautions"
  | "contact_plus_precautions"
  | "droplet_precautions"
  | "airborne_precautions"
  | "single_room"
  | "cohort_room"
  | "enhanced_environmental_cleaning"
  | "notify_ipc_team"
  | "notify_attending"
  | "notify_public_health"
  | "screen_contacts";

export type EscalationTiming = "immediate" | "same_shift" | "within_24h" | "next_business_day";
export type IPCRuleGovernanceStatus = "active" | "review_only" | "draft" | "disabled";
export type IPCRuleCategory =
  | "organism_alert"
  | "phenotype_alert"
  | "colonisation_screen"
  | "clearance"
  | "outbreak_watch"
  | "notification"
  | "review";
export type IPCRuleOwner = "IPC" | "Microbiology" | "AMS" | "Joint";

export const IPC_RULES_CONFIG_VERSION = "local-ipc-rules.v1.0.0";

export interface IPCRule {
  ruleCode: string;
  /** Trigger keys evaluated by the engine. */
  organismCodes?: string[];
  phenotypeFlags?: string[];
  /** Optional ward-context filter; empty = all wards. */
  wardScopes?: string[];
  /** Rolling window in days for repeat detection / outbreak candidate. */
  rollingWindowDays?: number;
  /** Required clearance count for screen pathways. */
  clearanceCount?: number;
  actions: IPCAction[];
  notify: string[]; // recipient roles/teams
  timing: EscalationTiming;
  message: string;
  governanceStatus?: IPCRuleGovernanceStatus;
  ruleCategory?: IPCRuleCategory;
  ruleOwner?: IPCRuleOwner;
  sourceLabel?: string;
  reviewDate?: string;
  lastReviewedBy?: string;
  version?: string;
  localPolicyRef?: string;
  rationale?: string;
  limitation?: string;
}

export const IPC_RULES: IPCRule[] = [
  {
    ruleCode: "SAUR_REVIEW",
    organismCodes: ["SAUR"],
    actions: ["notify_ipc_team"],
    notify: ["ipc_nurse"],
    timing: "within_24h",
    message:
      "IPC review advised: Staphylococcus aureus isolated. Confirm MRSA status when AST or expert rules are available.",
    governanceStatus: "review_only",
    ruleCategory: "review",
    ruleOwner: "Joint",
    sourceLabel: "Local IPC review baseline",
    reviewDate: "2026-04-25",
    lastReviewedBy: "IPC/Microbiology",
    version: "1.0.0",
    localPolicyRef: "IPC-REVIEW-SAUR",
    rationale: "Organism-first review trigger while awaiting phenotype confirmation.",
  },
  {
    ruleCode: "ENTEROCOCCUS_REVIEW",
    organismCodes: ["EFAM", "EFAE"],
    actions: ["notify_ipc_team"],
    notify: ["ipc_nurse"],
    timing: "within_24h",
    message:
      "IPC review advised: Enterococcus isolated. Confirm VRE status when AST or expert rules are available.",
    governanceStatus: "review_only",
    ruleCategory: "review",
    ruleOwner: "Joint",
    sourceLabel: "Local IPC review baseline",
    reviewDate: "2026-04-25",
    lastReviewedBy: "IPC/Microbiology",
    version: "1.0.0",
    localPolicyRef: "IPC-REVIEW-ENTEROCOCCUS",
    rationale: "Review-only pathway until VRE phenotype is confirmed.",
  },
  {
    ruleCode: "ENTEROBACTERALES_REVIEW",
    organismCodes: ["KPNE", "ECOL", "ENTC", "PMIR"],
    actions: ["notify_ipc_team"],
    notify: ["ipc_nurse"],
    timing: "within_24h",
    message:
      "IPC review advised: Enterobacterales isolated. Monitor for ESBL/CRE phenotype and escalate if carbapenem resistance is detected.",
    governanceStatus: "review_only",
    ruleCategory: "review",
    ruleOwner: "Joint",
    sourceLabel: "Local IPC review baseline",
    reviewDate: "2026-04-25",
    lastReviewedBy: "IPC/Microbiology",
    version: "1.0.0",
    localPolicyRef: "IPC-REVIEW-ENTEROBACTERALES",
    rationale: "Supports early IPC visibility before resistance phenotype alerts fire.",
  },
  {
    ruleCode: "NONFERMENTER_REVIEW",
    organismCodes: ["PAER", "ABAU"],
    actions: ["notify_ipc_team"],
    notify: ["ipc_nurse"],
    timing: "within_24h",
    message:
      "IPC review advised: high-risk non-fermenter isolated. Monitor MDR/carbapenem resistance and apply local placement precautions if resistance emerges.",
    governanceStatus: "review_only",
    ruleCategory: "review",
    ruleOwner: "Joint",
    sourceLabel: "Local IPC review baseline",
    reviewDate: "2026-04-25",
    lastReviewedBy: "IPC/Microbiology",
    version: "1.0.0",
    localPolicyRef: "IPC-REVIEW-NONFERMENTER",
    rationale: "Review trigger for high-risk non-fermenters pending phenotype escalation.",
  },
  {
    ruleCode: "MRSA_ALERT",
    phenotypeFlags: ["MRSA"],
    rollingWindowDays: 90,
    clearanceCount: 3,
    actions: ["contact_precautions", "single_room", "notify_ipc_team"],
    notify: ["ipc_nurse", "attending"],
    timing: "same_shift",
    message:
      "IPC alert: MRSA phenotype detected. Apply local MRSA isolation, screening, and notification pathway.",
    governanceStatus: "active",
    ruleCategory: "phenotype_alert",
    ruleOwner: "IPC",
    sourceLabel: "Local MRSA policy",
    reviewDate: "2026-04-25",
    lastReviewedBy: "IPC",
    version: "1.0.0",
    localPolicyRef: "IPC-MRSA-ALERT",
    rationale: "Same-shift escalation for MRSA phenotype detection.",
  },
  {
    ruleCode: "VRE_ALERT",
    phenotypeFlags: ["VRE"],
    rollingWindowDays: 90,
    clearanceCount: 3,
    actions: [
      "contact_plus_precautions",
      "single_room",
      "enhanced_environmental_cleaning",
      "notify_ipc_team",
    ],
    notify: ["ipc_nurse", "attending"],
    timing: "same_shift",
    message:
      "IPC alert: VRE phenotype detected. Apply local VRE contact-plus precautions and notification pathway.",
    governanceStatus: "active",
    ruleCategory: "phenotype_alert",
    ruleOwner: "IPC",
    sourceLabel: "Local VRE policy",
    reviewDate: "2026-04-25",
    lastReviewedBy: "IPC",
    version: "1.0.0",
    localPolicyRef: "IPC-VRE-ALERT",
    rationale: "Same-shift VRE escalation for contact-plus precautions.",
  },
  {
    ruleCode: "CRE_ALERT",
    phenotypeFlags: ["CRE", "carbapenemase_suspected"],
    rollingWindowDays: 180,
    actions: [
      "contact_plus_precautions",
      "single_room",
      "notify_ipc_team",
      "notify_public_health",
      "screen_contacts",
    ],
    notify: ["ipc_nurse", "attending", "public_health_unit"],
    timing: "immediate",
    message:
      "IPC alert: carbapenemase/CRE signal detected. Notify IPC and apply local MDRO precautions.",
    governanceStatus: "active",
    ruleCategory: "phenotype_alert",
    ruleOwner: "Joint",
    sourceLabel: "Local CRE/CPE policy",
    reviewDate: "2026-04-25",
    lastReviewedBy: "IPC/Microbiology",
    version: "1.0.0",
    localPolicyRef: "IPC-CRE-ALERT",
    rationale: "Immediate escalation for CRE/carbapenemase phenotype.",
  },
  {
    ruleCode: "CRAB_ALERT",
    organismCodes: ["ABAU"],
    phenotypeFlags: ["carbapenemase_suspected"],
    actions: [
      "contact_plus_precautions",
      "single_room",
      "enhanced_environmental_cleaning",
      "notify_ipc_team",
    ],
    notify: ["ipc_nurse"],
    timing: "immediate",
    message:
      "IPC alert: carbapenem-resistant Acinetobacter signal detected. Apply local MDRO precautions.",
    governanceStatus: "active",
    ruleCategory: "phenotype_alert",
    ruleOwner: "Joint",
    sourceLabel: "Local CRAB policy",
    reviewDate: "2026-04-25",
    lastReviewedBy: "IPC/Microbiology",
    version: "1.0.0",
    localPolicyRef: "IPC-CRAB-ALERT",
    rationale: "Immediate escalation for carbapenem-resistant Acinetobacter signal.",
  },
  {
    ruleCode: "CRPA_ALERT",
    organismCodes: ["PAER"],
    phenotypeFlags: ["carbapenemase_suspected"],
    actions: ["contact_precautions", "single_room", "notify_ipc_team"],
    notify: ["ipc_nurse"],
    timing: "same_shift",
    message:
      "IPC alert: carbapenem-resistant Pseudomonas signal detected. Apply local placement and water-source review policy.",
    governanceStatus: "active",
    ruleCategory: "phenotype_alert",
    ruleOwner: "Joint",
    sourceLabel: "Local CRPA policy",
    reviewDate: "2026-04-25",
    lastReviewedBy: "IPC/Microbiology",
    version: "1.0.0",
    localPolicyRef: "IPC-CRPA-ALERT",
    rationale: "Same-shift escalation for carbapenem-resistant Pseudomonas signal.",
  },
  {
    ruleCode: "CAURIS_ALERT",
    organismCodes: ["CAUR"],
    actions: [
      "contact_plus_precautions",
      "single_room",
      "enhanced_environmental_cleaning",
      "notify_ipc_team",
      "notify_public_health",
      "screen_contacts",
    ],
    notify: ["ipc_nurse", "public_health_unit"],
    timing: "immediate",
    message:
      "IPC alert: Candida auris isolated. Urgent IPC notification and isolation/environmental cleaning according to local policy.",
    governanceStatus: "active",
    ruleCategory: "organism_alert",
    ruleOwner: "IPC",
    sourceLabel: "Local Candida auris policy",
    reviewDate: "2026-04-25",
    lastReviewedBy: "IPC",
    version: "1.0.0",
    localPolicyRef: "IPC-CAURIS-ALERT",
    rationale: "Immediate escalation for high-priority organism alert.",
  },
  {
    ruleCode: "MTB_ALERT",
    organismCodes: ["MTUB"],
    actions: ["airborne_precautions", "single_room", "notify_ipc_team", "notify_public_health"],
    notify: ["ipc_nurse", "public_health_unit"],
    timing: "immediate",
    message:
      "IPC alert: Mycobacterium tuberculosis complex isolated. Apply local airborne precautions and notification policy.",
    governanceStatus: "active",
    ruleCategory: "organism_alert",
    ruleOwner: "IPC",
    sourceLabel: "Local TB isolation policy",
    reviewDate: "2026-04-25",
    lastReviewedBy: "IPC",
    version: "1.0.0",
    localPolicyRef: "IPC-MTB-ALERT",
    rationale: "Immediate airborne and notification escalation for TB complex.",
  },
  {
    ruleCode: "ESBL_INVASIVE",
    phenotypeFlags: ["ESBL"],
    wardScopes: ["ICU", "Paediatrics", "Neonatal"],
    actions: ["contact_precautions", "notify_ipc_team"],
    notify: ["ipc_nurse"],
    timing: "within_24h",
    message: "Invasive ESBL in high-risk ward — contact precautions, AMS review.",
    governanceStatus: "review_only",
    ruleCategory: "phenotype_alert",
    ruleOwner: "Joint",
    sourceLabel: "Local ESBL high-risk ward policy",
    reviewDate: "2026-04-25",
    lastReviewedBy: "IPC/AMS",
    version: "1.0.0",
    localPolicyRef: "IPC-ESBL-HIGHRISK",
    rationale: "Ward-scoped ESBL escalation in high-risk units.",
    limitation:
      "Browser-phase visibility only; production editing requires backend audit and permissions.",
  },
];

export function rulesFor(
  organismCode: string | undefined,
  phenotypes: string[],
  ward?: string,
): IPCRule[] {
  return IPC_RULES.filter((r) => {
    if (r.governanceStatus === "disabled") return false;
    const orgMatch = !r.organismCodes || (organismCode && r.organismCodes.includes(organismCode));
    const phenMatch = !r.phenotypeFlags || r.phenotypeFlags.some((f) => phenotypes.includes(f));
    const wardMatch = !r.wardScopes || (ward && r.wardScopes.includes(ward));
    if (r.organismCodes && r.phenotypeFlags) return orgMatch && phenMatch && wardMatch;
    if (r.organismCodes) return orgMatch && wardMatch;
    if (r.phenotypeFlags) return phenMatch && wardMatch;
    return false;
  });
}
