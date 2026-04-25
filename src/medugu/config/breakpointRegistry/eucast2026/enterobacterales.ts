import type { EucastBreakpointRecord } from "../types";
import { EUCAST_2026_PLACEHOLDER_RECORDS } from "./notes";

// EUCAST 2026 Enterobacterales registry scaffold.
// Keep this list empty/needs_validation until official EUCAST tables are loaded.
export const EUCAST_2026_ENTEROBACTERALES_BREAKPOINTS: EucastBreakpointRecord[] =
  EUCAST_2026_PLACEHOLDER_RECORDS.filter((b) => b.organismGroup === "enterobacterales");
