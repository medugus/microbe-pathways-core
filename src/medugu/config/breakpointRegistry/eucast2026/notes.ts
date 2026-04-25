import type { EucastBreakpointRecord } from "../types";

export const EUCAST_2026_METADATA = {
  standard: "EUCAST" as const,
  version: "2026 v16.0" as const,
  year: 2026,
  sourceLabel: "EUCAST Clinical Breakpoint Tables v16.0, 2026" as const,
};

// NOTE: Do not add active breakpoint values unless an official EUCAST source
// table (XLS/PDF) is committed in this repository and cited in sourceTableRef.
export const EUCAST_2026_PLACEHOLDER_RECORDS: EucastBreakpointRecord[] = [
  {
    ...EUCAST_2026_METADATA,
    organismGroup: "enterobacterales",
    antibioticCode: "MEM",
    method: "mic",
    interpretationCategories: ["S", "I", "R", "ND"],
    breakpointStatus: "needs_validation",
    notes: "Placeholder scaffold row only. No thresholds until official source is added.",
  },
  {
    ...EUCAST_2026_METADATA,
    organismGroup: "staphylococcus",
    antibioticCode: "FOX",
    method: "disk",
    interpretationCategories: ["S", "I", "R", "ND"],
    breakpointStatus: "needs_validation",
    notes: "Placeholder scaffold row only. No thresholds until official source is added.",
  },
];
