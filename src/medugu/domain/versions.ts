// Centralised version pins. Logic modules import from here so that the
// versions in force are explicit, portable, and framework-agnostic.

import type { RuleVersion } from "./types";

export const BUILD_VERSION = "3.0.0-phase1";
export const EXPORT_VERSION = "export-1.0.0";
export const BREAKPOINT_VERSION = "EUCAST-2024";

export const RULE_VERSION: RuleVersion = {
  ruleSetId: "medugu.rules",
  version: "1.0.0-phase1",
  effectiveFrom: "2025-01-01",
};
