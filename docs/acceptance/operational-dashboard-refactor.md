# Operational dashboard refactor acceptance

## Why the dashboard logic was split

`src/medugu/logic/operationalDashboard.ts` previously combined queue derivation, category/priority ordering, summary metrics, target-section mapping, and limitation messaging in one file. Splitting these concerns reduces change surface area and lowers regression risk for future maintenance.

## Files created

- `src/medugu/logic/dashboard/dashboardTypes.ts`
- `src/medugu/logic/dashboard/dashboardQueue.ts`
- `src/medugu/logic/dashboard/dashboardPriority.ts`
- `src/medugu/logic/dashboard/dashboardMetrics.ts`
- `src/medugu/logic/dashboard/dashboardNavigation.ts`
- `src/medugu/logic/dashboard/dashboardSummary.ts`
- `src/medugu/logic/dashboard/dashboardLimitations.ts`

## Old/new structure and size snapshot

- Previous monolithic `operationalDashboard.ts` size at the pre-refactor parent commit (`8867c54^`): **618 lines**.
- Current `operationalDashboard.ts` façade size: **36 lines**.
- Current façade role: re-export public types/functions and compose `deriveOperationalDashboard` from focused modules.

## Public API preserved

`src/medugu/logic/operationalDashboard.ts` remains the public façade and continues to export:

- `deriveOperationalDashboard`
- `deriveOperationalQueueItems`
- `getOperationalPriority`
- `sortOperationalQueueItems`
- `getOperationalSummary`
- `describeOperationalDashboardLimitations`
- Existing exported dashboard queue and summary types

## Behaviour intentionally unchanged

This refactor moved logic only. It does not alter AST interpretation, breakpoint logic, AMS logic, IPC logic, validation/release rules, report/export logic, auth, server calls, or UI behavior.

## Manual validation checklist

Status: **Not executed in this CLI-only run** (checklist preserved for manual browser verification).

- [ ] Open dashboard.
- [ ] Confirm summary cards match previous values for loaded demo data.
- [ ] Confirm operational queue renders.
- [ ] Confirm AMS item jumps to AMS.
- [ ] Confirm IPC item jumps to IPC.
- [ ] Confirm Release blocker jumps to Release.
- [ ] Confirm Validation warning jumps to Validation.
- [ ] Confirm browser-local limitation text is still visible.
- [ ] Confirm negative/released/no-action case does not create false urgent queue item.

## Known future work

- Add dedicated tests for dashboard target-section mapping across all queue categories.
- Add focused unit tests for summary median-age edge cases.
- Consider stricter module-level test coverage for outbreak watch queue enrichment.
