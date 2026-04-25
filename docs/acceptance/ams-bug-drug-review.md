# AMS bug-drug review and de-escalation acceptance

## 1) Scope
This change adds AMS stewardship **review-support** logic for microbiology bug-drug mismatch, resistant-result review, de-escalation opportunity detection, restricted/Reserve review, and insufficient-data handling in the AMS recommendations workflow.

## 2) Safety limits
- Decision support only.
- No automatic prescribing.
- No automatic therapy changes.
- No dosing recommendations.
- Recommendation wording remains review-oriented (review/consider/approval required/de-escalation opportunity/insufficient data).

## 3) Inputs used
- Organism context (including gram context where available).
- Specimen/syndrome context from specimen resolver.
- AST interpretation (`finalInterpretation` / `interpretedSIR`).
- AWaRe category.
- Restriction/release class and AMS approval state.
- Governance/reportability state (governance + clinician visibility).

## 4) Recommendation categories
- `bug_drug_mismatch`
- `resistant_result_review`
- `de_escalation_opportunity`
- `restricted_approval_required`
- `reserve_review`
- `continue_or_no_action`
- `insufficient_data`

## 5) Example scenarios
1. Therapy under review has R result for organism-drug pair -> review mismatch.
2. Spectrum mismatch (gram-positive-only drug against gram-negative isolate, and inverse where configured) -> review mismatch.
3. Broad/restricted/Watch/Reserve under review with reportable narrower active options -> de-escalation opportunity.
4. Reserve agent under review -> Reserve review.
5. Restricted/local approval required under review -> approval required recommendation.
6. Missing therapy/AST/organism inputs -> insufficient data recommendation.

## 6) Out-of-scope dosing/prescribing claims
Out of scope:
- Any automatic medication ordering.
- Any automatic stop/start/change instructions.
- Any dose optimisation text.

## 7) Manual validation checklist
- [ ] Ceftriaxone under review with ceftriaxone-resistant Enterobacterales isolate -> mismatch/review appears.
- [ ] Meropenem/Reserve-context item with susceptible narrower reportable option -> de-escalation opportunity appears.
- [ ] Access antibiotic active and unrestricted with no escalation signals -> continue/no-action appears.
- [ ] Restricted antibiotic pending approval -> restricted approval-required appears and AMS workflow remains intact.
- [ ] No therapy under review -> insufficient-data appears for therapy-specific review.
- [ ] Suppressed/non-reportable narrow option is not surfaced as de-escalation option.
- [ ] CSF/meningitis context avoids simplistic de-escalation unless explicitly configured.

