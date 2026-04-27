# Config/version coherence acceptance (Medugu)

## 1) Active version constants

Current domain pins are defined in `src/medugu/domain/versions.ts`:

- `BUILD_VERSION`: `3.0.0-phase1`
- `EXPORT_VERSION`: `export-1.1.0`
- `RULE_VERSION`: `medugu.rules@1.0.0-phase1` (effective `2025-01-01`)
- `BREAKPOINT_VERSION`: `CLSI-primary|EUCAST-2024-active-secondary|EUCAST-2026-candidate-reference`
- `ACTIVE_BREAKPOINT_STANDARD`: `CLSI`
- `BREAKPOINT_CANDIDATE_POLICY`: `EUCAST 2026 candidate records present; not active unless breakpointStatus is active.`

## 2) Candidate/reference configuration policy

Governance policy for breakpoint tables:

- Candidate/reference records may be present in config for traceability and staged validation.
- Interpretation MUST use only rows with `breakpointStatus: "active"`.
- Records with `breakpointStatus: "needs_validation"`, `"draft"`, `"disabled"`, or `"not_applicable"` are excluded from `findMICBreakpoint` / `findDiskBreakpoint` lookup paths.
- Presence of candidate records does not imply activation.

## 3) EUCAST 2026 candidate status

- EUCAST 2026 records exist under `src/medugu/config/breakpointRegistry/eucast2026/*`.
- Registry metadata marks this dataset as candidate/reference governance via notes and status labels.
- Many rows are explicitly `needs_validation` and therefore non-active.
- Any rows marked `active` remain controlled by per-row status and are only used when an AST row selects `standard: "EUCAST"`.
- The default AST standard remains CLSI.

## 4) How `breakpointStatus` controls activation

Activation is controlled in lookup functions:

- `findMICBreakpoint(...)`: includes only rows where `(b.breakpointStatus ?? "active") === "active"` and thresholds exist.
- `findDiskBreakpoint(...)`: includes only rows where `(b.breakpointStatus ?? "active") === "active"` and thresholds exist.

Therefore candidate rows in the registry do not change interpretation unless explicitly promoted to `active`.

## 5) How versions are frozen into release packages

Version fields are assigned to each accession and then frozen at release:

- Accession assignment occurs at new-accession/state-seed time (`ruleVersion`, `breakpointVersion`, `exportVersion`, `buildVersion`).
- Release sealing snapshots report body and version metadata into immutable `releasePackage` fields:
  - `ruleVersion`
  - `breakpointVersion`
  - `exportVersion`
  - `buildVersion`
- Export/read paths prefer frozen release package metadata when present.

This prevents later config edits from silently changing metadata of already released reports.

## 6) Where version metadata appears in reports/exports

Version labels appear in:

- Report preview document (`versions.rule`, `versions.breakpoint`, `versions.export`, `versions.build`).
- Frozen release package metadata (`releasePackage.*Version`).
- FHIR export (`DiagnosticReport.extension` entries for rule/breakpoint/export/build versions).
- HL7 export (`NTE` segment with version summary).
- Normalised JSON export (`versions` object).
- Export gate metadata (`evaluateExportGate(...).versions`).

## 7) Manual validation checklist

Use this checklist after config updates:

1. Confirm `PRIMARY_STANDARD` remains intended default.
2. Confirm `BREAKPOINT_VERSION` label still matches active/candidate reality.
3. Confirm EUCAST 2026 candidate rows retain non-active status unless formally validated.
4. Verify AST interpretation for existing released accessions is unchanged.
5. Release a test accession and confirm frozen package versions are populated.
6. Edit live accession metadata post-release and verify exports still use frozen release package versions.
7. Verify report preview, FHIR, HL7, and normalised JSON all expose coherent version labels.
8. Confirm stewardship and IPC metadata versions/source labels remain present.

## 8) Future work (formal configuration governance)

- Introduce explicit structured metadata object for all config sets (status, approver, validation date).
- Add CI checks that fail when candidate datasets are mislabeled as active defaults.
- Add release-time attestation bundle for config provenance and approval references.
- Add governance dashboard highlighting active vs candidate assets by domain (AST, AMS, IPC, export).
