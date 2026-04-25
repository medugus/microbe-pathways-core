# IPC acceptance scenarios (browser-phase)

## 1) Purpose
Lock IPC behaviour with named acceptance scenarios before adding additional IPC complexity.

## 2) Scope
Covers IPC Command Centre behaviour for:
- IPC signal generation and rule explanation metadata.
- IPC action checklist expectations from fired rule actions.
- Colonisation tracker workflow separation from diagnostic culture workflows.
- Local outbreak watch patient-adjusted dedup and watch severity.
- IPC officer queue prioritisation and browser-local limitation messaging.
- IPC rule governance panel metadata/coverage visibility without changing rule firing.

Out of scope: AST, AMS, breakpoint logic, specimen compatibility logic, validation logic, release logic, report/export logic, auth, and server calls.

## 3) Browser-phase limitation
These checks are browser-local and operate on currently loaded cases only.

Production hospital-wide surveillance requires backend persistence, roles and durable audit.

## 4) Test data / scenario table

| Scenario | Key fixture | Expected result |
|---|---|---|
| CRE sterile-site case | `creSterileSiteCase` | `CRE_ALERT`, immediate/high-priority signal, contact-plus actions, IPC notification target, rule explanation text available. |
| MRSA bloodstream case | `mrsaBloodstreamCase` | `MRSA_ALERT`, same-shift IPC signal, notification target present, action checklist content present. |
| VRE case | `vreCase` | `VRE_ALERT`, contact-plus/review actions and same-shift notification path. |
| Candida auris screen positive | `candidaAurisScreenPositiveCase` | `CAURIS_ALERT`, high-priority signal, colonisation positive context, queue critical/high positioning. |
| MRSA admission screen positive | `mrsaAdmissionScreenPositiveCase` | Colonisation screen workflow identified with carrier-status path. |
| CRE clearance negative after prior positive | `creClearanceSeries` | Clearance counter increments for currently loaded cases and displays browser-local limitation note. |
| Three ICU CRE cases within 7 days | `creClusterIcuCases` | Local outbreak watch item with patient-adjusted count `3`, severity watch/high, summary `outbreak watch`. |
| Repeated cultures from same patient | `repeatedSamePatientCreCases` | Local watch deduplicates per patient; repeated cultures do not inflate patient-adjusted count. |
| Negative / no-signal case | `negativeNoSignalCase` | No IPC signals and useful empty/no-signal state guidance. |

## 5) Expected IPC signals
- High-risk organisms/phenotypes (CRE, MRSA, VRE, Candida auris) fire IPC signals via configured rule metadata.
- Signal entries expose rule code/message so UI can show rule explanation.
- Signal action metadata remains checklist-ready (e.g., precautions/notifications/screen contacts).

## 6) Expected colonisation tracker outputs
- Colonisation screens are detected via colonisation family/subtype.
- Diagnostic cultures (e.g., blood culture) remain distinct and return “Not a colonisation-screen workflow.”
- Clearance counter is based on currently loaded cases.
- Missing prior positive produces safe limitation wording.

## 7) Expected local outbreak watch outputs
- Local watch uses patient-adjusted dedup (same patient counted once per episode grouping).
- Three different patients in ICU/7-day window generate an outbreak watch condition.
- Language remains “possible cluster” / “outbreak watch” and does not claim confirmed outbreak.

## 8) Expected officer queue outputs
- Candida auris and CRE high-priority items sort above routine/review items.
- Colonisation positives appear as queue entries.
- Clearance incomplete appears as queue entries.
- Limitation note remains browser-local and tied to currently loaded cases.

## 9) Expected governance panel outputs
- Governance summary counts configured rules.
- Rules missing actions are flagged.
- Rules missing notification targets are flagged.
- `getRuleForSignal` links a fired signal to matching rule metadata where available.

## 10) Manual browser validation steps
1. Open IPC Command Centre and load scenario fixtures.
2. Confirm rule explanation text is visible for CRE/MRSA/VRE/Candida auris signals.
3. Confirm action checklist matches rule actions/notifications.
4. Open colonisation tracker for MRSA admission and CRE clearance fixtures; verify screen vs diagnostic behaviour.
5. Open local watch panel and verify ICU 3-patient scenario emits outbreak watch with patient-adjusted count.
6. Verify repeated same-patient CRE entries do not inflate patient-adjusted counts.
7. Open IPC officer queue and verify high-risk prioritisation and limitation note wording.
8. Open IPC rule governance panel and verify metadata summaries do not alter rule firing outputs.
9. Open negative/no-signal fixture and confirm empty/no-signal guidance remains informative.

## 11) Out-of-scope production claims
This acceptance package does not claim:
- confirmed outbreak adjudication.
- production hospital-wide surveillance (without backend persistence/roles/audit).
- durable clearance certification.

It explicitly states that production hospital-wide surveillance requires backend persistence, roles and durable audit.
