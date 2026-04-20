# Known issues — browser-phase final

Last refreshed: **2026-04-20**.

This list is the authoritative defect log for the browser-phase build. It
intentionally excludes anything that is a planned Phase-5 (server-backed)
behaviour and not a defect against the browser-phase contract.

## Open defects

### DEF-001 — Sterile-site IPC critical alert does not require phone-out

- **Scenario:** 3 (`MB25-CRE001`).
- **Symptom:** `runValidation` returns no blockers when an IPC `CRE_ALERT`
  fires on a sterile-site specimen and no acknowledged phone-out exists.
  `evaluateExportGate` therefore allows export immediately after release.
- **Expected:** When any of `CRE_ALERT`, `MRSA_ALERT`, `VRE_ALERT`,
  `CAURIS_ALERT`, `CRAB_ALERT`, `CRPA_ALERT` fires on a `sterile_site`
  specimen subtype and there is no acknowledged phone-out, `runValidation`
  emits `PHONE_OUT_REQUIRED` as a blocker until a phone-out is recorded.
- **Status:** Re-opened. A previous patch addressing this was not present in
  the current source tree at regression time.
- **Owner:** validationEngine.
- **Severity:** high (patient-safety relevant for sterile-site critical
  alerts).
- **Workaround:** record an acknowledged phone-out manually before release;
  the existing `phoneOutRequired` path on `criticalCommunicationRequired`
  still covers blood-culture and significant-isolate pathways.

## Resolved / non-defects

### DEF-002 — Sputum rejection warning code

- **Scenario:** 4 (`MB25-NP78QR`).
- **Status:** **closed (matrix corrected, no code change).** Previous matrix
  expected `MIC_REQUIRED_MISSING`. Current engine emits `ISO_NONE`, which is
  correct (rejected sputum legitimately has no isolate; microscopy is not
  required for the rejection profile). Acceptance matrix updated to expect
  `ISO_NONE`.

### Screening CRE alert (Scenario 6)

- **Status:** **not a defect.** The screening isolate is a CRE phenotype, so
  `CRE_ALERT` firing on a colonisation specimen is correct surveillance
  behaviour. Antibiotic visibility is correctly controlled by stewardship's
  `screening_only` flag at report build time.

## Review points (non-blocking)

- The MRSA scenario also fires `inducible_clindamycin_R` from the expert
  rules. This is an additional expected output and does not affect
  acceptance, but should be called out in any clinician-facing
  walk-through so reviewers are not surprised by an extra phenotype chip.
- `AMS_PENDING_RESTRICTED` warnings appear on every scenario that has any
  restricted agent — by design. Reviewers should treat them as
  informational, not as defects.
