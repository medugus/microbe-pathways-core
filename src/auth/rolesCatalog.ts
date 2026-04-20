// Catalog of every role the Medugu UI knows about.
//
// Two distinct concepts live here:
//
//   1. "implemented" roles — present in the public.app_role Postgres enum and
//      enforced by RLS / has_role(). These are the only roles that grant any
//      real authority in the current build.
//
//   2. "planned" roles — names from the clinical role model that are NOT yet
//      in the DB enum. They are surfaced in the All Roles view so the operator
//      can see the full target model and which slots are still placeholder.
//
// Adding a planned role here does NOT grant it any privileges. It only makes
// it visible in the role inspector so we can track what is real vs. aspirational.

import type { AppRole } from "./AuthContext";

export type RoleStatus = "implemented" | "planned";

export interface RoleCatalogEntry {
  /** Stable code shown in chips and audit. */
  code: string;
  /** Human display name. */
  displayName: string;
  /** One-line description of clinical responsibility. */
  description: string;
  /** Whether the role exists in the current DB enum + RLS policies. */
  status: RoleStatus;
  /**
   * The DB-enum value this UI role maps to, if any. `null` for planned roles
   * that have no backing enum yet.
   */
  dbRole: AppRole | null;
}

export const ROLE_CATALOG: readonly RoleCatalogEntry[] = [
  {
    code: "ADMIN",
    displayName: "Administrator",
    description: "Tenant + user + receiver + config administration.",
    status: "implemented",
    dbRole: "admin",
  },
  {
    code: "LAB_TECH",
    displayName: "Laboratory Technologist",
    description: "Bench-level data entry, microscopy, AST capture.",
    status: "implemented",
    dbRole: "lab_tech",
  },
  {
    code: "SENIOR_SCIENTIST",
    displayName: "Senior Scientist",
    description: "Bench supervision and second-check role (planned, not yet in enum).",
    status: "planned",
    dbRole: null,
  },
  {
    code: "CONSULTANT_MICROBIOLOGIST",
    displayName: "Consultant Microbiologist",
    description: "Authorises consultant-required releases and amendments.",
    status: "implemented",
    dbRole: "consultant",
  },
  {
    code: "MICROBIOLOGIST",
    displayName: "Microbiologist",
    description: "Routine validation and release for non-restricted cases.",
    status: "implemented",
    dbRole: "microbiologist",
  },
  {
    code: "AMS_PHARMACIST",
    displayName: "AMS Pharmacist",
    description: "Reviews and approves restricted antimicrobial requests.",
    status: "implemented",
    dbRole: "ams_pharmacist",
  },
  {
    code: "IPC_OFFICER",
    displayName: "IPC Officer",
    description: "Handles IPC signals, cohorting, and surveillance episodes.",
    status: "implemented",
    dbRole: "ipc",
  },
  {
    code: "CLINICIAN",
    displayName: "Clinician (Requesting)",
    description: "Orders investigations and receives reports (planned — out-of-app today).",
    status: "planned",
    dbRole: null,
  },
] as const;

export function getCatalogEntryByDbRole(role: AppRole): RoleCatalogEntry | undefined {
  return ROLE_CATALOG.find((r) => r.dbRole === role);
}
