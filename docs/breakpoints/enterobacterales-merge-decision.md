# Enterobacterales EUCAST PR — Merge Decision Guide

Date: 2026-04-28

## Short answer

- **For panel completeness:** yes, this can merge (all current Enterobacterales panel members now have active rows).
- **For stricter production semantics:** optionally hold until subgroup/specimen caveat routing is explicitly enforced.

## What is already active in the panel

`AMP`, `AMC`, `TZP`, `CXM`, `FEP`, `CTX`, `CAZ`, `CRO`, `ETP`, `IPM`, `MEM`, `ATM`, `AMK`, `GEN`, `CIP`, `LVX`, `SXT`, `TGC`

## What is still pending

- No panel-member rows are pending for the current Enterobacterales panel set.
- Remaining follow-up is **scope governance**, not missing thresholds:
  - Ensure subgroup/specimen caveats are enforced in routing (e.g., Morganellaceae / Serratia / UTI-origin rows).

## Recommended decision

1. **Merge now** if your release gate accepts the current caveat handling in notes/routing.
2. **Hold merge** only if you require explicit subgroup/specimen routing enforcement before enabling EUCAST in production.

## If you want me to finish the rest now

If you want stricter handling, send subgroup/specimen routing rules (not breakpoint numbers), especially for `IPM`, `AMK`, `GEN`, and `SXT`.

Provide each item in this shape:

```text
antibioticCode:
method: mic|disk
S threshold:
R threshold:
categories: S/I/R/ND
constraints: subgroup/specimen/indication
sourceTableRef:
```

I can patch them in one batch and re-run coverage/type checks.
