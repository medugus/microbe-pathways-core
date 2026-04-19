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
    ruleCode: "MRSA_ALERT",
    organismCodes: ["SAUR"],
    phenotypeFlags: ["MRSA"],
    rollingWindowDays: 90,
    clearanceCount: 3,
    actions: ["contact_precautions", "single_room", "notify_ipc_team"],
    notify: ["ipc_nurse", "attending"],
    timing: "same_shift",
    message: "MRSA isolated — apply contact precautions; screen ward contacts.",
  },
  {
    ruleCode: "VRE_ALERT",
    organismCodes: ["EFAM", "EFAE"],
    phenotypeFlags: ["VRE"],
    rollingWindowDays: 90,
    clearanceCount: 3,
    actions: ["contact_plus_precautions", "single_room", "enhanced_environmental_cleaning", "notify_ipc_team"],
    notify: ["ipc_nurse", "attending"],
    timing: "same_shift",
    message: "VRE isolated — contact-plus precautions, dedicated equipment, daily disinfection.",
  },
  {
    ruleCode: "CRE_ALERT",
    phenotypeFlags: ["CRE", "carbapenemase_suspected"],
    rollingWindowDays: 180,
    actions: ["contact_plus_precautions", "single_room", "notify_ipc_team", "notify_public_health", "screen_contacts"],
    notify: ["ipc_nurse", "attending", "public_health_unit"],
    timing: "immediate",
    message: "CRE / carbapenemase suspected — IMMEDIATE notification, contact-plus precautions, contact screening.",
  },
  {
    ruleCode: "CRAB_ALERT",
    organismCodes: ["ABAU"],
    phenotypeFlags: ["carbapenemase_suspected"],
    actions: ["contact_plus_precautions", "single_room", "enhanced_environmental_cleaning", "notify_ipc_team"],
    notify: ["ipc_nurse"],
    timing: "immediate",
    message: "Carbapenem-resistant Acinetobacter — contact-plus precautions, environmental focus.",
  },
  {
    ruleCode: "CRPA_ALERT",
    organismCodes: ["PAER"],
    phenotypeFlags: ["carbapenemase_suspected"],
    actions: ["contact_precautions", "single_room", "notify_ipc_team"],
    notify: ["ipc_nurse"],
    timing: "same_shift",
    message: "Carbapenem-resistant Pseudomonas — contact precautions, water-source review.",
  },
  {
    ruleCode: "CAURIS_ALERT",
    organismCodes: ["CAUR"],
    actions: ["contact_plus_precautions", "single_room", "enhanced_environmental_cleaning", "notify_ipc_team", "notify_public_health", "screen_contacts"],
    notify: ["ipc_nurse", "public_health_unit"],
    timing: "immediate",
    message: "Candida auris — IMMEDIATE notification; isolate, dedicated equipment, contact screening.",
  },
  {
    ruleCode: "CDI_ALERT",
    organismCodes: ["CDIF"],
    actions: ["contact_precautions", "single_room", "enhanced_environmental_cleaning", "notify_ipc_team"],
    notify: ["ipc_nurse"],
    timing: "same_shift",
    message: "C. difficile — contact precautions, soap-and-water hand hygiene, sporicidal cleaning.",
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
