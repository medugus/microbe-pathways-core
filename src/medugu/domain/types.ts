// Domain types — single source of truth for the accession model.
// Framework-agnostic. No React imports anywhere in this file.
//
// Contract-aligned entity names (Phase 1):
//   Patient, Accession, Specimen, SpecimenAssessment, Microscopy, Isolate,
//   ASTResult, InterpretiveComment, PhoneOutEvent, IPCSignal, ReleasePackage,
//   AuditEvent, RuleVersion.

import type {
  ASTInterpretation,
  ASTMethod,
  GramResult,
  IPCFlag,
  Priority,
  ReleaseState,
  Sex,
  StewardshipFlag,
  WorkflowStage,
} from "./enums";

// ---------- Versioning ----------

export interface RuleVersion {
  /** Semver-like identifier of the validation/expert-rule pack in force. */
  ruleSetId: string;
  version: string;
  effectiveFrom: string; // ISO date
}

// ---------- Identity & audit ----------

export interface AuditEvent {
  id: string;
  at: string;            // ISO timestamp
  actor: string;         // user code (single-user phase: "local")
  action: string;        // e.g. "ast.entered"
  section?: string;
  /** Field-level diff for state-changing actions. */
  field?: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
  details?: Record<string, unknown>;
}

// ---------- Patient ----------

export interface Patient {
  mrn: string;
  givenName: string;
  familyName: string;
  sex: Sex;
  dob?: string;
  ward?: string;
  attendingClinician?: string;
  encounterId?: string;
}

// ---------- Specimen (coded, not free-text) ----------

export interface Specimen {
  familyCode: string;
  subtypeCode: string;
  bodySiteCode?: string;
  collectionMethodCode?: string;
  collectedAt?: string;
  receivedAt?: string;
  containerCode?: string;
  volumeMl?: number;
  /** Display only; never drives logic. */
  freeTextLabel?: string;
}

/** Backwards-compat alias for older imports. */
export type CodedSpecimen = Specimen;

/**
 * SpecimenAssessment — pre-analytical acceptability check
 * (leak, clot, mislabel, insufficient volume, transport delay, etc.).
 */
export interface SpecimenAssessment {
  id: string;
  assessedAt: string;
  assessedBy: string;
  acceptable: boolean;
  rejectionReasonCode?: string;
  conditionFlags: string[]; // coded: leaked, clotted, mislabelled, delayed, insufficient
  notes?: string;
}

// ---------- Microscopy ----------

export interface Microscopy {
  id: string;
  stainCode: string;
  result: GramResult | string;
  cellsPerHpf?: number;
  organismsSeen?: string;
  notes?: string;
}
/** Backwards-compat alias. */
export type MicroscopyFinding = Microscopy;

// ---------- Isolate ----------

export type IsolateSignificance =
  | "significant"
  | "probable_contaminant"
  | "mixed_growth"
  | "normal_flora"
  | "indeterminate";

export interface Isolate {
  id: string;
  isolateNo: number;
  organismCode: string;
  organismDisplay: string;
  /** Coded growth quantifier (e.g. SCANTY, MODERATE, HEAVY, >1e5_CFU_ML). */
  growthQuantifierCode?: string;
  /** Numeric colony count when measured; UI-only display formatted via helpers. */
  colonyCountCfuPerMl?: number;
  significance?: IsolateSignificance;
  purityFlag?: boolean;
  /** True when this isolate participates in a mixed-growth context. */
  mixedGrowth?: boolean;
  identifiedAt?: string;
  identificationMethodCode?: string;
  notes?: string;
}

// ---------- AST ----------

export type ASTStandard = "CLSI" | "EUCAST";
export type ASTGovernanceState = "draft" | "interpreted" | "approved" | "released";
export type ASTCascadeState = "primary" | "cascade_pending" | "cascaded" | "suppressed";

/** Phenotype flags inferred by the AST expert-rule engine. */
export type PhenotypeFlag =
  | "MRSA"
  | "MSSA"
  | "ESBL"
  | "AmpC_suspected"
  | "CRE"
  | "carbapenemase_suspected"
  | "VRE"
  | "VSE"
  | "inducible_clindamycin_R"
  | "intrinsic_R"
  | "unusual_antibiogram";

export interface ExpertRuleFiring {
  ruleCode: string;
  ruleVersion?: string;
  message: string;
  firedAt: string;
  /** Optional override audit attached when consultant overrides the rule. */
  override?: {
    actor: string;
    at: string;
    reason: string;
    newInterpretation?: ASTInterpretation;
  };
}

export interface ASTResult {
  id: string;
  isolateId: string;
  antibioticCode: string;
  method: ASTMethod;
  /** Standard in force for this row — CLSI primary, EUCAST secondary by config. */
  standard: ASTStandard;
  /** Raw measurement value (MIC mg/L or zone mm depending on method). */
  rawValue?: number;
  rawUnit?: "mg/L" | "mm";
  /** Convenience mirrors of rawValue for legacy readers. */
  micMgL?: number;
  zoneMm?: number;
  rawInterpretation?: ASTInterpretation;
  /** Interpretation after expert rules; may differ from raw. */
  interpretedSIR?: ASTInterpretation;
  finalInterpretation?: ASTInterpretation;
  governance: ASTGovernanceState;
  cascade: ASTCascadeState;
  /** Active cascade decision: shown / hidden_until_promoted / suppressed_by_phenotype. */
  cascadeDecision?: "shown" | "hidden_until_promoted" | "suppressed_by_phenotype";
  /** Phenotype flags fired against the parent isolate (mirrored on AST rows for filter ease). */
  phenotypeFlags?: PhenotypeFlag[];
  /** @deprecated use phenotypeFlags. */
  phenotypeCode?: string;
  /** Expert rules that fired against this row, with override audit. */
  expertRulesFired?: ExpertRuleFiring[];
  /** @deprecated use expertRulesFired[].ruleCode */
  ruleAppliedCode?: string;
  /** Stewardship hint computed against this row (note ref or inline). */
  stewardshipNoteRef?: string;
  stewardshipNote?: string;
  /** Consultant override audit at the row level (in addition to per-rule). */
  consultantOverride?: {
    actor: string;
    at: string;
    reason: string;
    fromInterpretation?: ASTInterpretation;
    toInterpretation?: ASTInterpretation;
  };
  comment?: string;
}

// ---------- Interpretive comments ----------

export interface InterpretiveComment {
  id: string;
  scope: "accession" | "isolate" | "ast";
  targetId?: string;       // isolateId or astResultId when applicable
  code: string;            // FK -> config/interpretiveComments
  text: string;            // resolved/rendered text
  authoredAt: string;
  authoredBy: string;
}

// ---------- Phone-out / critical communication ----------

export interface PhoneOutEvent {
  id: string;
  at: string;
  calledBy: string;
  recipient: string;        // clinician name/role
  recipientContact?: string;
  reasonCode: string;       // critical_value, alert_organism, etc.
  message: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
}

// ---------- Stewardship ----------

export interface StewardshipNote {
  id: string;
  flag: StewardshipFlag;
  message: string;
  raisedAt: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

// ---------- IPC ----------

export interface IPCSignal {
  id: string;
  flag: IPCFlag;
  organismCode?: string;
  ruleCode: string;
  message: string;
  raisedAt: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

// ---------- Validation ----------

export interface ValidationIssue {
  id: string;
  severity: "info" | "warn" | "block";
  code: string;
  message: string;
  section: string;
}

// ---------- Release / Report ----------

export interface ConsultantApproval {
  approvedBy: string;
  approvedAt: string;
  reason?: string;
}

export interface ReleaseRecord {
  state: ReleaseState;
  releasedAt?: string;
  releasedBy?: string;
  amendmentReason?: string;
  reportVersion: number;
  /** Required when resolver.gating.consultantReleaseRequired is true. */
  consultantApproval?: ConsultantApproval;
  /** SHA-256 of the canonical release body — server-issued seal. */
  sealHash?: string;
}

/**
 * ReleasePackage — the immutable bundle produced at release time.
 * Snapshots the rendered report plus the versions in force.
 */
export interface ReleasePackage {
  builtAt: string;
  version: number;
  body: unknown;                    // structured report doc
  ruleVersion: string;
  breakpointVersion: string;
  exportVersion: string;
  buildVersion: string;
}

// ---------- Accession (root aggregate) ----------

export interface Accession {
  /** Accession number, e.g. MB25-XXXXXX. */
  id: string;
  accessionNumber: string;          // mirrors id; explicit per contract
  createdAt: string;
  updatedAt: string;
  releasedAt?: string;
  releasingActor?: string;

  workflowStatus: WorkflowStage;    // contract field name
  /** @deprecated use workflowStatus. Kept for migration. */
  stage: WorkflowStage;

  priority: Priority;

  // Version pins captured on the accession at creation/release time.
  ruleVersion: string;
  breakpointVersion: string;
  exportVersion: string;
  buildVersion: string;

  patient: Patient;
  specimen: Specimen;
  specimenAssessments: SpecimenAssessment[];

  microscopy: Microscopy[];
  isolates: Isolate[];
  ast: ASTResult[];
  interpretiveComments: InterpretiveComment[];
  phoneOuts: PhoneOutEvent[];
  stewardship: StewardshipNote[];
  ipc: IPCSignal[];

  validation: ValidationIssue[];
  release: ReleaseRecord;
  releasePackage?: ReleasePackage;

  audit: AuditEvent[];
}

// ---------- Persisted store shape ----------

export interface MeduguState {
  schemaVersion: number;
  accessions: Record<string, Accession>;
  accessionOrder: string[];
  activeAccessionId: string | null;
  ruleVersion: RuleVersion;
  breakpointVersion: string;
  exportVersion: string;
  buildVersion: string;
}
