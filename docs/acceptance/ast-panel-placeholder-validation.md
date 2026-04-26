# AST panel placeholder validation governance

## Purpose
Prevent blank AST template/panel rows from creating false `AST_INCOMPLETE` release blockers.

## Resulted/release-relevant AST row definition
An AST row is treated as started/resulted/release-relevant only when there is real result evidence, including one or more of:

- `rawValue`, `zoneMm`, or `micMgL`.
- `rawInterpretation`, `interpretedSIR`, or `finalInterpretation`.
- explicit review evidence (`consultantOverride`, fired expert-rule audit, or non-draft governance state).

Rows with no value, no interpretation, and draft-only placeholder state are panel placeholders and are excluded from incomplete-result blockers.

## Validation behaviour
- `AST_INCOMPLETE` fires only for release-relevant rows where final S/I/R is still missing.
- `AST_NOT_APPROVED` warning remains for release-relevant rows that still have `governance: draft`.
- Blank panel placeholders do **not** produce `AST_INCOMPLETE`.

## Regression scenarios
1. Urine Enterobacterales panel loaded with only AMP/CIP entered:
   - AMP/CIP continue to validate normally.
   - blank rows (AMC/CXM/CRO/CAZ/FEP/TZP/ETP/MEM/GEN/AMK/LVX/NIT/FOS/SXT) do not raise `AST_INCOMPLETE`.
2. Enter MEM as a real result:
   - row becomes release-relevant and participates in normal AST/AMS governance.
3. Missing urine microscopy requirements remain governed by existing specimen-pathway rules.
