# AMS validation and release governance

## 1. Purpose
Expose unresolved AMS decision-support items at validation and release governance points so operators can review pending approvals and stewardship signals before release.

## 2. Scope
- Adds AMS governance helper logic for validation/release context.
- Surfaces AMS items in validation issues and Release section context panel.
- Keeps AMS clinician-report visibility conservative by default.
- Aligns dashboard AMS pending/restricted queue counts to release-relevant AST rows only.

## 3. Safety defaults
- AMS recommendations remain decision support only.
- Default report visibility is `internal_only`.
- No automatic prescribing, dosing, stop/switch, or therapy-change actions are generated.
- Restricted/Reserve approval gating maps to blocker only where approval-required governance already exists.

## 4. AMS items that create validation blockers
- `restricted_approval_required` when approval is not documented **and** the AST row is release-relevant.
- `reserve_review` where approval-required governance remains unresolved on a release-relevant AST row.

### 4.1 Release-relevant AST row definition (AMS gating)
An AST row is AMS release-relevant only when all are true:
1. Row is linked to an existing isolate on the accession.
2. Row has clinical-result evidence (`rawValue`, interpreted/final/raw interpretation, or explicit review evidence).
3. Row is not cascade-suppressed/hidden.
4. Row is not a blank panel/template placeholder with no entered result.
5. Row is clinician-reportable or requires AMS approval under governance/reportability.

## 5. AMS items that create validation warnings
- `bug_drug_mismatch`.
- `resistant_result_review` (therapy under review but resistant/intermediate context).
- `de_escalation_opportunity` as advisory (info/warning metadata).
- `insufficient_data` as info unless restricted approval context elevates it.

## 6. Report visibility rule
AMS output is not added to clinician-facing report by default. Clinician-facing display requires:
1. `reportVisibility: clinician_report` metadata,
2. explicit clinician-facing text, and
3. an existing safe clinician/internal separation surface.

Current implementation remains validation/release-facing only.

## 7. Manual scenarios
1. **Restricted meropenem pending approval**
   - Validation shows AMS approval blocker when approval-required state unresolved.
   - Release context panel shows pending approval / blocker.
   - No automatic clinician-facing AMS comment.
2. **Restricted meropenem approved**
   - AMS blocker clears.
   - Release can proceed if other blockers are absent.
3. **Ceftriaxone-resistant Enterobacterales under review**
   - Validation warning appears with review wording.
   - Release context shows bug-drug/review count.
4. **De-escalation opportunity**
   - Info/warning advisory wording only (consider/review).
   - No forced release block by default.
5. **No therapy under review**
   - Insufficient-data info only.
   - No release block from this signal alone.
6. **No AMS action case**
   - No AMS validation issue.
   - Release behaviour unchanged.
7. **Template panel restricted rows with no entered result**
   - Unentered restricted panel rows do not create AMS blockers.
   - Dashboard AMS pending/restricted count remains clear for these placeholders.
8. **Entered restricted result**
   - Restricted row appears in AMS pending/restricted dashboard queue when result is truly entered.
   - Approval clears blocker as expected.
9. **Report preview check**
   - No AMS recommendation text leaks into clinician-facing report unless explicitly configured.

## 8. Out of scope
- Any automatic prescribing or dosing recommendation.
- Any automatic therapy switching/stopping behaviour.
- AST interpretation, breakpoint, IPC, specimen, auth, server-call, or package configuration changes.
