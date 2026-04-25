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
}

export const IPC_RULES: IPCRule[] = [
  {
    ruleCode: "SAUR_REVIEW",
    organismCodes: ["SAUR"],
    actions: ["notify_ipc_team"],
    notify: ["ipc_nurse"],
    timing: "within_24h",
    message: "IPC review advised: Staphylococcus aureus isolated. Confirm MRSA status when AST or expert rules are available.",
  },
  {
    ruleCode: "ENTEROCOCCUS_REVIEW",
    organismCodes: ["EFAM", "EFAE"],
    actions: ["notify_ipc_team"],
    notify: ["ipc_nurse"],
    timing: "within_24h",
    message: "IPC review advised: Enterococcus isolated. Confirm VRE status when AST or expert rules are available.",
  },
  {
    ruleCode: "ENTEROBACTERALES_REVIEW",
    organismCodes: ["KPNE", "ECOL", "ENTC", "PMIR"],
    actions: ["notify_ipc_team"],
    notify: ["ipc_nurse"],
    timing: "within_24h",
    message: "IPC review advised: Enterobacterales isolated. Monitor for ESBL/CRE phenotype and escalate if carbapenem resistance is detected.",
  },
  {
    ruleCode: "NONFERMENTER_REVIEW",
    organismCodes: ["PAER", "ABAU"],
    actions: ["notify_ipc_team"],
    notify: ["ipc_nurse"],
    timing: "within_24h",
    message: "IPC review advised: high-risk non-fermenter isolated. Monitor MDR/carbapenem resistance and apply local placement precautions if resistance emerges.",
  },
  {
    ruleCode: "MRSA_ALERT",
    phenotypeFlags: ["MRSA"],
    rollingWindowDays: 90,
    clearanceCount: 3,
    actions: ["contact_precautions", "single_room", "notify_ipc_team"],
    notify: ["ipc_nurse", "attending"],
    timing: "same_shift",
    message: "IPC alert: MRSA phenotype detected. Apply local MRSA isolation, screening, and notification pathway.",
  },
  {
    ruleCode: "VRE_ALERT",
    phenotypeFlags: ["VRE"],
    rollingWindowDays: 90,
    clearanceCount: 3,
    actions: ["contact_plus_precautions", "single_room", "enhanced_environmental_cleaning", "notify_ipc_team"],
    notify: ["ipc_nurse", "attending"],
    timing: "same_shift",
    message: "IPC alert: VRE phenotype detected. Apply local VRE contact-plus precautions and notification pathway.",
  },
  {
    ruleCode: "CRE_ALERT",
    phenotypeFlags: ["CRE", "carbapenemase_suspected"],
    rollingWindowDays: 180,
    actions: ["contact_plus_precautions", "single_room", "notify_ipc_team", "notify_public_health", "screen_contacts"],
    notify: ["ipc_nurse", "attending", "public_health_unit"],
    timing: "immediate",
    message: "IPC alert: carbapenemase/CRE signal detected. Notify IPC and apply local MDRO precautions.",
  },
  {
    ruleCode: "CRAB_ALERT",
    organismCodes: ["ABAU"],
    phenotypeFlags: ["carbapenemase_suspected"],
    actions: ["contact_plus_precautions", "single_room", "enhanced_environmental_cleaning", "notify_ipc_team"],
    notify: ["ipc_nurse"],
    timing: "immediate",
    message: "IPC alert: carbapenem-resistant Acinetobacter signal detected. Apply local MDRO precautions.",
  },
  {
    ruleCode: "CRPA_ALERT",
    organismCodes: ["PAER"],
    phenotypeFlags: ["carbapenemase_suspected"],
    actions: ["contact_precautions", "single_room", "notify_ipc_team"],
    notify: ["ipc_nurse"],
    timing: "same_shift",
    message: "IPC alert: carbapenem-resistant Pseudomonas signal detected. Apply local placement and water-source review policy.",
  },
  {
    ruleCode: "CAURIS_ALERT",
    organismCodes: ["CAUR"],
    actions: ["contact_plus_precautions", "single_room", "enhanced_environmental_cleaning", "notify_ipc_team", "notify_public_health", "screen_contacts"],
    notify: ["ipc_nurse", "public_health_unit"],
    timing: "immediate",
    message: "IPC alert: Candida auris isolated. Urgent IPC notification and isolation/environmental cleaning according to local policy.",
  },
  {
    ruleCode: "MTB_ALERT",
    organismCodes: ["MTUB"],
    actions: ["airborne_precautions", "single_room", "notify_ipc_team", "notify_public_health"],
    notify: ["ipc_nurse", "public_health_unit"],
    timing: "immediate",
    message: "IPC alert: Mycobacterium tuberculosis complex isolated. Apply local airborne precautions and notification policy.",
  },
  {
    ruleCode: "ESBL_INVASIVE",
    phenotypeFlags: ["ESBL"],
    wardScopes: ["ICU", "Paediatrics", "Neonatal"],
    actions: ["contact_precautions", "notify_ipc_team"],
    notify: ["ipc_nurse"],
    timing: "within_24h",
    message: "Invasive ESBL in high-risk ward — contact precautions, AMS review.",
  },
];

export function rulesFor(organismCode: string | undefined, phenotypes: string[], ward?: string): IPCRule[] {
  return IPC_RULES.filter((r) => {
    const orgMatch = !r.organismCodes || (organismCode && r.organismCodes.includes(organismCode));
    const phenMatch = !r.phenotypeFlags || r.phenotypeFlags.some((f) => phenotypes.includes(f));
    const wardMatch = !r.wardScopes || (ward && r.wardScopes.includes(ward));
    if (r.organismCodes && r.phenotypeFlags) return orgMatch && phenMatch && wardMatch;
    if (r.organismCodes) return orgMatch && wardMatch;
    if (r.phenotypeFlags) return phenMatch && wardMatch;
    return false;
  });
}
