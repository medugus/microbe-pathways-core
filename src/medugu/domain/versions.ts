// Centralised version pins. Logic modules import from here so that the
// versions in force are explicit, portable, and framework-agnostic.

import type { RuleVersion } from "./types";

export const BUILD_VERSION = "3.0.0-phase1";
export const EXPORT_VERSION = "export-1.1.0";
/**
 * Active interpretation metadata label pinned into accessions/release packages.
 * Governance intent:
 * - CLSI is the primary/default AST standard in this build.
 * - EUCAST 2024 rows are the active EUCAST secondary set.
 * - EUCAST 2026 rows may exist as candidate/reference records and MUST NOT be
 *   treated as active unless breakpointStatus is explicitly "active".
 */
export const BREAKPOINT_VERSION =
  "CLSI-primary|EUCAST-2024-active-secondary|EUCAST-2026-candidate-reference";
export const ACTIVE_BREAKPOINT_STANDARD = "CLSI";
export const BREAKPOINT_CANDIDATE_POLICY =
  "EUCAST 2026 candidate records present; not active unless breakpointStatus is active.";

export const RULE_VERSION: RuleVersion = {
  ruleSetId: "medugu.rules",
  version: "1.0.0-phase1",
  effectiveFrom: "2025-01-01",
};
