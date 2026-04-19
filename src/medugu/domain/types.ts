// Domain types — single source of truth for the accession model.
// Framework-agnostic. No React imports anywhere in this file.

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

// ---------- Identity & audit ----------

export interface AuditEvent {
  id: string;
  at: string;          // ISO timestamp
  actor: string;       // user code (single-user phase: "local")
  action: string;      // e.g. "accession.created", "ast.entered"
  section?: string;
  details?: Record<string, unknown>;
}

// ---------- Patient ----------

export interface Patient {
  mrn: string;
  givenName: string;
  familyName: string;
  sex: Sex;
  dob?: string;            // ISO date
  ward?: string;
  attendingClinician?: string;
  encounterId?: string;
}

// ---------- Specimen (coded, not free-text) ----------

export interface CodedSpecimen {
  familyCode: string;      // FK -> config/specimenFamilies
  subtypeCode: string;     // FK -> config/specimenFamilies (subtype)
  bodySiteCode?: string;
  collectionMethodCode?: string;
  collectedAt?: string;    // ISO
  receivedAt?: string;     // ISO
  containerCode?: string;
  volumeMl?: number;
  freeTextLabel?: string;  // display only; never drives logic
}

// ---------- Microscopy ----------

export interface MicroscopyFinding {
  id: string;
  stainCode: string;       // gram, ZN, India ink, KOH, calcofluor, etc.
  result: GramResult | string;
  cellsPerHpf?: number;
  organismsSeen?: string;  // morphology description code
  notes?: string;
}

// ---------- Isolate ----------

export interface Isolate {
  id: string;
  isolateNo: number;            // 1..n per accession
  organismCode: string;         // FK -> config/organisms
  organismDisplay: string;      // cached label
  growthQuantifierCode?: string;// e.g. light/moderate/heavy/cfu/ml bucket
  purityFlag?: boolean;
  identifiedAt?: string;
  identificationMethodCode?: string;
}

// ---------- AST ----------

export interface ASTResult {
  id: string;
  isolateId: string;
  antibioticCode: string;       // FK -> config/antibiotics
  method: ASTMethod;
  micMgL?: number;
  zoneMm?: number;
  rawInterpretation?: ASTInterpretation; // instrument-derived
  finalInterpretation?: ASTInterpretation; // post-rules
  ruleAppliedCode?: string;     // FK -> breakpoints/expert rule
  comment?: string;
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
  ruleCode: string;             // FK -> config/ipcRules
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

export interface ReleaseRecord {
  state: ReleaseState;
  releasedAt?: string;
  releasedBy?: string;
  amendmentReason?: string;
  reportVersion: number;
}

export interface ReportSnapshot {
  builtAt: string;
  version: number;
  body: unknown;                // structured report doc; rendered by ReportSection
}

// ---------- Accession (root aggregate) ----------

export interface Accession {
  id: string;                   // accession no, e.g. MB25-XXXXXX
  createdAt: string;
  updatedAt: string;
  priority: Priority;
  stage: WorkflowStage;

  patient: Patient;
  specimen: CodedSpecimen;

  microscopy: MicroscopyFinding[];
  isolates: Isolate[];
  ast: ASTResult[];
  stewardship: StewardshipNote[];
  ipc: IPCSignal[];

  validation: ValidationIssue[];
  release: ReleaseRecord;
  report?: ReportSnapshot;

  audit: AuditEvent[];
}

// ---------- Persisted store shape ----------

export interface MeduguState {
  schemaVersion: number;
  accessions: Record<string, Accession>;
  accessionOrder: string[];     // insertion order for list view
  activeAccessionId: string | null;
}
