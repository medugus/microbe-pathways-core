export type OperationalQueueCategory =
  | "critical_result"
  | "release_blocker"
  | "validation_warning"
  | "ipc_high_priority"
  | "ipc_action"
  | "ipc_outbreak_watch"
  | "colonisation_follow_up"
  | "ams_restricted"
  | "ams_pending_approval"
  | "consultant_approval"
  | "phone_out"
  | "routine_review";

export type OperationalQueuePriority = "critical" | "high" | "review" | "routine";

export type OperationalQueueOwnerRole =
  | "bench_scientist"
  | "senior_scientist"
  | "consultant_microbiologist"
  | "ams_pharmacist"
  | "ipc_officer"
  | "mixed";

export type OperationalQueueSourceModule =
  | "IPC"
  | "AMS"
  | "Validation"
  | "Release"
  | "AST"
  | "Specimen";

export type OperationalQueueTargetSection =
  | "IPC"
  | "AMS"
  | "Validation"
  | "Release"
  | "AST"
  | "Specimen"
  | "Report"
  | "Dashboard";

export type OperationalQueueItem = {
  id: string;
  accessionId: string;
  targetAccessionId: string;
  targetSection: OperationalQueueTargetSection;
  accessionNumber?: string;
  patientLabel?: string;
  ward?: string;
  specimenLabel?: string;
  organismOrPhenotype?: string;
  category: OperationalQueueCategory;
  priority: OperationalQueuePriority;
  reason: string;
  recommendedAction: string;
  ownerRole: OperationalQueueOwnerRole;
  dueLabel?: string;
  ageHours?: number;
  sourceModule: OperationalQueueSourceModule;
  limitationNote?: string;
};

export type OperationalQueueItemDraft = Omit<
  OperationalQueueItem,
  "targetAccessionId" | "targetSection"
>;

export type OperationalDashboardSummary = {
  totalLoadedCases: number;
  openQueueItems: number;
  criticalOrHighPriorityQueueItems: number;
  criticalUrgentCases: number;
  releaseBlocked: number;
  pendingPhoneOut: number;
  pendingConsultantApproval: number;
  amsPendingOrRestricted: number;
  ipcHighPriority: number;
  colonisationOrClearanceFollowUp: number;
  releasedOrCompletedCases: number;
  noActionCases: number;
  medianOpenQueueAgeHours: number | null;
};

export type OperationalDashboardData = {
  items: OperationalQueueItem[];
  summary: OperationalDashboardSummary;
  limitationNote: string;
};
