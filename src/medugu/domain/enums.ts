// Framework-agnostic enums for the microbiology workflow.

export const WorkflowStage = {
  Registered: "registered",
  SpecimenReceived: "specimen_received",
  Microscopy: "microscopy",
  Culture: "culture",
  Isolate: "isolate",
  AST: "ast",
  Stewardship: "stewardship",
  IPC: "ipc",
  Validation: "validation",
  Released: "released",
} as const;
export type WorkflowStage = (typeof WorkflowStage)[keyof typeof WorkflowStage];

export const ReleaseState = {
  Draft: "draft",
  PendingValidation: "pending_validation",
  Validated: "validated",
  Released: "released",
  Amended: "amended",
  Cancelled: "cancelled",
} as const;
export type ReleaseState = (typeof ReleaseState)[keyof typeof ReleaseState];

export const Priority = {
  Routine: "routine",
  Urgent: "urgent",
  Stat: "stat",
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

export const Sex = {
  Male: "male",
  Female: "female",
  Other: "other",
  Unknown: "unknown",
} as const;
export type Sex = (typeof Sex)[keyof typeof Sex];

export const GramResult = {
  GramPositive: "gram_positive",
  GramNegative: "gram_negative",
  GramVariable: "gram_variable",
  NotApplicable: "not_applicable",
  NoOrganismsSeen: "no_organisms_seen",
} as const;
export type GramResult = (typeof GramResult)[keyof typeof GramResult];

export const ASTMethod = {
  DiskDiffusion: "disk_diffusion",
  MIC_Broth: "mic_broth",
  MIC_Etest: "mic_etest",
  Automated_Vitek: "automated_vitek",
  Automated_Phoenix: "automated_phoenix",
} as const;
export type ASTMethod = (typeof ASTMethod)[keyof typeof ASTMethod];

export const ASTInterpretation = {
  S: "S",
  I: "I",
  R: "R",
  SDD: "SDD", // susceptible dose-dependent
  NS: "NS", // non-susceptible
  ND: "ND", // not determined
} as const;
export type ASTInterpretation = (typeof ASTInterpretation)[keyof typeof ASTInterpretation];

export const StewardshipFlag = {
  RestrictedAgent: "restricted_agent",
  RedundantCoverage: "redundant_coverage",
  BugDrugMismatch: "bug_drug_mismatch",
  DeEscalationCandidate: "de_escalation_candidate",
  IVtoPOCandidate: "iv_to_po_candidate",
} as const;
export type StewardshipFlag = (typeof StewardshipFlag)[keyof typeof StewardshipFlag];

export const IPCFlag = {
  AlertOrganism: "alert_organism",
  MDRO: "mdro",
  XDR: "xdr",
  PDR: "pdr",
  CarbapenemResistant: "carbapenem_resistant",
  OutbreakCandidate: "outbreak_candidate",
} as const;
export type IPCFlag = (typeof IPCFlag)[keyof typeof IPCFlag];
