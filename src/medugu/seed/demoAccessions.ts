// Seeded demo accessions — used when no persisted state exists.
// Phase-2 scenarios cover the workflow patterns the workflow core must demonstrate.

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
  // Urine MSU — quantitative interpretation scaffold
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
  // Blood culture — critical communication placeholder pathway
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
      subtypeCode: "BC_CENTRAL_LINE",
      collectedAt: now,
      receivedAt: now,
      containerCode: "BC_BOTTLE_AEROBIC",
      freeTextLabel: "Blood culture, central line",
    },
    ...emptyTail(),
    release: { state: ReleaseState.Draft, reportVersion: 0 },
  },
  // CSF — consultant-required release behaviour
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
      familyCode: "STERILE_FLUID",
      subtypeCode: "SF_CSF",
      collectedAt: now,
      receivedAt: now,
      containerCode: "STERILE_UNIVERSAL",
      volumeMl: 2,
      freeTextLabel: "CSF, lumbar puncture",
    },
    ...emptyTail(),
    release: { state: ReleaseState.PendingValidation, reportVersion: 0 },
  },
  // Sputum — Bartlett quality pathway
  {
    ...base("MB25-NP78QR", WorkflowStage.Microscopy),
    priority: Priority.Routine,
    patient: {
      mrn: "AMCE-001011",
      givenName: "Chika",
      familyName: "Nwosu",
      sex: Sex.Male,
      dob: "1955-06-04",
      ward: "Respiratory Ward",
      attendingClinician: "Dr. Okonkwo",
    },
    specimen: {
      familyCode: "LRT",
      subtypeCode: "LRT_SPUTUM",
      collectedAt: now,
      receivedAt: now,
      containerCode: "STERILE_UNIVERSAL",
      volumeMl: 5,
      freeTextLabel: "Sputum",
    },
    ...emptyTail(),
    release: { state: ReleaseState.Draft, reportVersion: 0 },
  },
  // Colonisation screen — clearance tracking placeholder
  {
    ...base("MB25-ST90UV", WorkflowStage.Culture),
    priority: Priority.Routine,
    patient: {
      mrn: "AMCE-001213",
      givenName: "Funmi",
      familyName: "Adebayo",
      sex: Sex.Female,
      dob: "1979-11-17",
      ward: "Surgical HDU",
      attendingClinician: "Dr. Ibrahim",
    },
    specimen: {
      familyCode: "COLONISATION",
      subtypeCode: "COL_CPE_RECTAL",
      collectedAt: now,
      receivedAt: now,
      containerCode: "SWAB_TRANSPORT",
      freeTextLabel: "CPE rectal screen",
    },
    ...emptyTail(),
    release: { state: ReleaseState.Draft, reportVersion: 0 },
  },
];
