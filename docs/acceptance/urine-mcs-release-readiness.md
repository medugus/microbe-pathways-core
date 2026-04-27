# Urine M/C/S release-readiness fixes (QA retest)

## Scope

This change addresses urine M/C/S defects from full QA retest:

1. Release AMS context staying blocked after restricted-drug approval.
2. Blank Enterobacterales panel rows creating false `AST_INCOMPLETE` blockers.
3. MRN/Identifier required UX not explicit in New Accession.
4. Blood-culture-only source state leaking into non-blood accession flow.

## Implemented behaviour

### 1) Release AMS context reconciles with approval status

- Release AMS blocker now clears when a restricted/release-blocking AST row is actually approved.
- Pending approval count remains the single source of truth for true pending approval state.
- Dashboard pending-approval queue remains aligned with the same approval state source.

### 2) Blank AST placeholders are explicit and safe

- Added AST action: **Remove unresulted AST rows**.
- Action removes only true placeholders with:
  - no raw value (and no MIC/zone mirror),
  - no raw/interpreted/final interpretation,
  - no comment.
- Validation now excludes these true placeholders from `AST_INCOMPLETE`.
- Started rows (data entered but no final interpretation) still block release.

### 3) MRN required UX in New Accession

- MRN/Identifier label now shows required marker (`*`).
- Inline error/help text is shown under MRN input.
- Create button disable state includes visible reason text in footer.

### 4) Urine vs blood source behaviour in New Accession

- When family changes away from blood culture, blood source selections and blood preset are reset.
- Blood-source requirement remains enforced only for blood-culture family.
- Urine continues through urine subtype path without blood source requirements.

## Exclusions (unchanged by this patch)

- AST interpretation logic.
- Breakpoint lookup logic.
- IPC logic.
- AMS recommendation rules (except release-context approval reconciliation).
- Report/export logic.
- Auth and server calls.
