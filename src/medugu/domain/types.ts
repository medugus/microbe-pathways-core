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
  /**
   * Resolver-driven captured field values (browser-phase).
   * Keys correspond to specimenResolver FieldKey entries (e.g. setCount,
   * bottleType, drawSite). Stored as opaque JSON; logic engines are free to
   * read specific keys but must not depend on schema beyond the resolver.
   */
  details?: Record<string, unknown>;
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
  /**
   * Blood culture per-bottle growth tracking. One row per (setNo, bottleType)
   * the lab loaded into the instrument. Optional (absent for non-BLOOD or for
   * isolates entered before per-bottle tracking was added). The row carries the
   * bottle-level growth call and, when growth, the positivity timestamp and
   * computed time-to-positivity in hours; downstream rules (e.g. differential
   * TTP for line vs peripheral) read this array.
   */
  bottleResults?: BloodBottleResult[];
  /**
   * Blood culture source linkage. Lists the positive (setNo, bottleType)
   * pairs this isolate was recovered from. Empty/absent for non-blood or
   * until the lab links sources. Drives report preview, normalised JSON
   * export, and validation that BC isolates are tied to a positive bottle.
   */
  bloodSourceLinks?: BloodSourceLink[];
}

export interface BloodSourceLink {
  setNo: number;
  bottleType: string;
}

export type BottleGrowthState = "growth" | "no_growth" | "pending";

/**
 * Bottle lifecycle status (Epic Beaker-style discrete state machine).
 *   received          → bottle accessioned at the lab, not yet on instrument
 *   loaded            → placed on continuous-monitoring instrument (BACTEC/BacT-Alert)
 *   incubating        → actively monitored, no flag
 *   flagged_positive  → instrument has flagged growth; awaits Gram + subculture
 *   removed           → unloaded after positive flag (workup in progress)
 *   terminal_negative → completed full incubation window with no flag
 *   discontinued      → pulled before terminal end (clinician request, lab error, contam call)
 */
export type BottleLifecycleStatus =
  | "received"
  | "loaded"
  | "incubating"
  | "flagged_positive"
  | "removed"
  | "terminal_negative"
  | "discontinued";

export type BottleTerminationReason =
  | "no_growth_complete"
  | "clinician_request"
  | "contaminated"
  | "lab_error"
  | "broken_bottle"
  | "other";

export interface BloodBottleResult {
  /** 1-based set number, matches Specimen.details.sets[idx].setNo. */
  setNo: number;
  /** Bottle type code (AEROBIC, ANAEROBIC, MYCOLOGY, ...). */
  bottleType: string;
  /**
   * Legacy/derived high-level growth call. Kept for backward compatibility with
   * downstream engines (worklist, export, isolate rules). Auto-derived from
   * `status` when present: flagged_positive/removed → "growth";
   * terminal_negative → "no_growth"; everything else → "pending".
   */
  growth: BottleGrowthState;
  /**
   * Discrete bottle lifecycle status (Beaker-style). Optional for backward
   * compatibility; when absent the UI renders status from `growth`.
   */
  status?: BottleLifecycleStatus;
  /** ISO timestamp the lab received the bottle (pre-load). */
  receivedAt?: string;
  /** ISO timestamp the bottle was loaded onto the instrument. */
  loadedAt?: string;
  /** ISO timestamp the bottle was unloaded (post-flag or post-terminal). */
  unloadedAt?: string;
  /** ISO timestamp the bottle was finalised (negative or discontinued). */
  terminatedAt?: string;
  /** Why the bottle was discontinued/terminated (when applicable). */
  terminationReason?: BottleTerminationReason;
  /** Per-bottle protocol override in days (e.g. extended-incubation request). */
  protocolDays?: number;
  /** Instrument identifier (e.g. BACTEC FX 1). */
  instrumentId?: string;
  /** Rack/cell coordinate on the instrument (e.g. "A12"). */
  instrumentCell?: string;
  /** ISO timestamp the bottle flagged positive (only when growth === "growth"). */
  positiveAt?: string;
  /**
   * Time-to-positivity in hours. Beaker convention: positiveAt − loadedAt
   * (instrument time-on-bottle). Falls back to positiveAt − drawTime when
   * loadedAt is missing — see drawToPositiveHours for the pre-analytic-inclusive
   * value.
   */
  ttpHours?: number;
  /**
   * Pre-analytic-inclusive elapsed hours (positiveAt − set.drawTime). Useful
   * for sepsis / collection-to-positive QA, distinct from instrument TTP.
   */
  drawToPositiveHours?: number;
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
  /** Human-readable reason for the cascade decision (selective reporting). */
  cascadeReason?: string;
  /** Cascade rule code that fired (e.g. EUCAST_ENB_MEM_CASCADE). */
  cascadeRuleCode?: string;
  /** Version label for the cascade ruleset that fired (audit). */
  cascadeRulesetVersion?: string;
  /** Manual override: lab/clinician released a cascaded drug anyway, with reason + audit. */
  cascadeOverride?: {
    released: boolean;
    actor: string;
    at: string;
    reason: string;
  };
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
  /** Composite breakpoint key used for this row's interpretation (audit). */
  breakpointKey?: string;
  /** Indication actually used by the resolver (e.g. "uti", "meningitis"). */
  indicationUsed?: string;
  /** Human label for the breakpoint table source, e.g. "EUCAST v16.0". */
  breakpointSource?: string;
  /** Flags surfaced from the breakpoint row (bracketed, restrictedSpecies, etc). */
  breakpointFlags?: {
    bracketed?: boolean;
    screeningOnly?: boolean;
    restrictedSpecies?: string[];
    meningitisOnly?: boolean;
    urinaryOnly?: boolean;
    oralOnly?: boolean;
  };
  /** True when species-restricted drug applied to wrong organism. Blocks release. */
  breakpointSpeciesViolation?: boolean;
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

// ---------- AMS restricted-drug approval (Stage 6, browser-phase) ----------

export type AMSApprovalStatus =
  | "not_requested"
  | "pending"
  | "approved"
  | "denied"
  | "expired";

export interface AMSApprovalEvent {
  at: string;
  actor: string;       // placeholder identity in browser-phase
  note?: string;
}

/**
 * One AMS approval request, scoped to a single AST row.
 * Browser-phase: actor is a free-text placeholder. There is no real
 * notification transport and no production SLA engine; the dueBy field
 * is informational only.
 */
export interface AMSApprovalRequest {
  id: string;
  astId: string;
  isolateId: string;
  antibioticCode: string;
  status: AMSApprovalStatus;
  /** ISO; computed from policy.slaHours at request time. */
  dueBy?: string;
  requested?: AMSApprovalEvent;
  decided?: AMSApprovalEvent;       // approve or deny
  expired?: AMSApprovalEvent;
  /** True when SLA has elapsed without a decision (UI hint, not enforcement). */
  escalated?: boolean;
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

  /** AMS restricted-drug approval requests (browser-phase only). */
  amsApprovals?: AMSApprovalRequest[];

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
