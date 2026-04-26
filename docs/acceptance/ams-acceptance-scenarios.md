# AMS acceptance scenarios (browser-phase)

## 1) Purpose
Lock current AMS decision support behaviour with named acceptance scenarios and lightweight regression checks before adding additional stewardship complexity.

## 2) Scope
This document and accompanying fixtures/tests cover:
- AMS recommendation clarity in the AMS Command Centre.
- Restricted/Reserve review and approval-required behaviour.
- Bug-drug mismatch review signals.
- De-escalation opportunity wording and guardrails.
- Insufficient-data behaviour when therapy context is missing.
- AMS rule governance metadata display and linkage.
- Dashboard AMS queue integration.

## 3) Safety limits
- Decision support only.
- Review/consider wording only.
- Approval required wording where applicable.
- Insufficient data when required context is missing.
- No automatic prescribing.
- No dose optimisation.

## 4) Browser-phase limitation
All AMS acceptance behaviour here is browser-local and limited to currently loaded fixtures/cases.

## 5) Test data and scenario table
| Scenario ID | Name | Core setup | Expected high-level outcome |
|---|---|---|---|
| AMS-ACC-001 | Restricted meropenem pending approval | Klebsiella pneumoniae, MEM under review, pending AMS approval | restricted/review recommendation with approval required language |
| AMS-ACC-002 | Ceftriaxone-resistant Enterobacterales under review | Enterobacterales, CRO resistant, pending review | bug-drug mismatch review signal |
| AMS-ACC-003 | Broad therapy with narrower active option | MEM under review plus active narrower CXM | de-escalation opportunity with cautious consider/review wording |
| AMS-ACC-004 | No therapy under review | AST present, no AMS therapy context | insufficient data, no guessed advice |
| AMS-ACC-005 | Access active unrestricted | GEN active in review context | continue_or_no_action convention |
| AMS-ACC-006 | CSF high-risk syndrome | SF_CSF with MEM under review and narrower option present | no simplistic de-escalation in high-risk syndrome |
| AMS-ACC-007 | Restricted Reserve approved | CST approved | approval state shown; not queued as pending |
| AMS-ACC-008 | No-AMS-action case | No growth / no AST review trigger | useful empty AMS state and no false AMS queue item |

## 6) Expected AMS recommendation outputs
- Approval-required recommendation for restricted/review context.
- Continue-or-no-action for active unrestricted context in review.
- Insufficient data for therapy-specific AMS review when therapy context is missing.
- Safety note retaining no automatic prescribing and no dose optimisation boundaries.

## 7) Expected bug-drug mismatch outputs
- Resistant drug under review yields bug_drug_mismatch (AMS_BUG_DRUG_R).
- Wording is review therapy, not automatic therapy change.

## 8) Expected de-escalation outputs
- De-escalation opportunity appears only when a narrower active option is available and reportable.
- Recommendation wording stays cautious (consider/review).
- Suppressed/non-reportable narrower options are not promoted.
- High-risk meningitis/CSF context does not receive simplistic de-escalation.

## 9) Expected approval workflow outputs
- Pending restricted/review rows display approval required state.
- Approved restricted Reserve row is recognised as approved and not treated as pending.

## 10) Expected dashboard queue outputs
- Pending restricted item appears as AMS pending approval in dashboard queue.
- Approved restricted item is not incorrectly prioritised as pending.
- No-AMS-action scenario does not generate a false AMS queue item.

## 11) Expected governance panel outputs
- Rule governance summary counts configured rules.
- Rules missing rationale/source are flagged in summary counts.
- Recommendation-to-rule linkage resolves via matched rule code where available.
- Governance panel behaviour remains read-only by design (browser-phase visibility only).

## 12) Manual browser validation steps
1. Open AMS Command Centre for each fixture accession.
2. Verify recommendation cards use review/consider language.
3. Verify restricted/review rows show approval required states where configured.
4. Verify missing therapy context shows insufficient data.
5. Verify high-risk CSF scenario does not show simplistic de-escalation.
6. Open operational dashboard and verify AMS queue behaviour for pending/approved/no-action cases.
7. Open AMS rule governance panel and verify metadata display only (no production editing path).

## 13) Out-of-scope production claims
- No automatic prescribing.
- No dose optimisation or patient-level dosing.
- No changes to AST interpretation logic, breakpoint logic, IPC logic, specimen logic, validation logic, release logic, report/export logic, auth, or server-side behaviour.
