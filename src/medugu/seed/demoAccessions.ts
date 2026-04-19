// Seeded demo accessions — used when no persisted state exists.
// Coded fields use placeholder dictionary codes that real config modules will define.

import type { Accession } from "../domain/types";
import { Priority, ReleaseState, Sex, WorkflowStage } from "../domain/enums";
import {
  BUILD_VERSION,
  BREAKPOINT_VERSION,
  EXPORT_VERSION,
  RULE_VERSION,
} from "../domain/versions";

const now = new Date().toISOString();

function emptyTail() {
  return {
    specimenAssessments: [],
    microscopy: [],
    isolates: [],
    ast: [],
    interpretiveComments: [],
    phoneOuts: [],
    stewardship: [],
    ipc: [],
    validation: [],
    audit: [],
    ruleVersion: RULE_VERSION.version,
    breakpointVersion: BREAKPOINT_VERSION,
    exportVersion: EXPORT_VERSION,
    buildVersion: BUILD_VERSION,
  };
}

function base(id: string, status: WorkflowStage) {
  return {
    id,
    accessionNumber: id,
    createdAt: now,
    updatedAt: now,
    workflowStatus: status,
    stage: status,
  };
}

export const DEMO_ACCESSIONS: Accession[] = [
  {
    ...base("MB25-AB12CD", WorkflowStage.SpecimenReceived),
    priority: Priority.Routine,
    patient: {
      mrn: "AMCE-000123",
      givenName: "Amaka",
      familyName: "Okafor",
      sex: Sex.Female,
      dob: "1991-04-12",
      ward: "Medical Ward A",
      attendingClinician: "Dr. Bello",
    },
    specimen: {
      familyCode: "URINE",
      subtypeCode: "URINE_MIDSTREAM",
      collectedAt: now,
      receivedAt: now,
      containerCode: "STERILE_UNIVERSAL",
      volumeMl: 20,
      freeTextLabel: "Mid-stream urine",
    },
    ...emptyTail(),
    release: { state: ReleaseState.Draft, reportVersion: 0 },
  },
  {
    ...base("MB25-EF34GH", WorkflowStage.Culture),
    priority: Priority.Urgent,
    patient: {
      mrn: "AMCE-000456",
      givenName: "Tunde",
      familyName: "Adeyemi",
      sex: Sex.Male,
      dob: "1968-09-30",
      ward: "ICU",
      attendingClinician: "Dr. Eze",
    },
    specimen: {
      familyCode: "BLOOD",
      subtypeCode: "BLOOD_CULTURE_AEROBIC",
      collectedAt: now,
      receivedAt: now,
      containerCode: "BC_BOTTLE_AEROBIC",
      freeTextLabel: "Blood culture, aerobic",
    },
    ...emptyTail(),
    release: { state: ReleaseState.Draft, reportVersion: 0 },
  },
  {
    ...base("MB25-JK56LM", WorkflowStage.AST),
    priority: Priority.Stat,
    patient: {
      mrn: "AMCE-000789",
      givenName: "Ngozi",
      familyName: "Umeh",
      sex: Sex.Female,
      dob: "2002-01-22",
      ward: "Paediatrics",
      attendingClinician: "Dr. Sani",
    },
    specimen: {
      familyCode: "CSF",
      subtypeCode: "CSF_LUMBAR",
      collectedAt: now,
      receivedAt: now,
      containerCode: "STERILE_UNIVERSAL",
      volumeMl: 2,
      freeTextLabel: "CSF, lumbar puncture",
    },
    ...emptyTail(),
    release: { state: ReleaseState.PendingValidation, reportVersion: 0 },
  },
];
