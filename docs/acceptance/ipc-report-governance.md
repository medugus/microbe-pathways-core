# IPC validation and report governance acceptance

## Scope

This change ensures IPC signals are surfaced in validation and release governance while preserving conservative report visibility defaults.

## Safety defaults

1. IPC signals are internal by default (`reportVisibility` defaults to `internal_only`).
2. Clinician-facing IPC report text requires explicit rule configuration (`reportVisibility: clinician_report` + `clinicianReportText`).
3. Open high-priority IPC signals may create release warnings.
4. Release blockers require explicit rule metadata (`releaseImpact: blocker` or `validationSeverity: blocker`).

## Browser-phase limitation

IPC governance remains browser-phase for local visibility/workflow only. Production policy editing and enforcement still require audited backend governance controls.

## Manual validation scenarios

1. **CRE high-priority IPC signal**
   - Expect validation warning: “Open IPC high-priority signal: CRE_ALERT. Confirm IPC action/notification before release.”
   - Expect no automatic clinician-facing IPC text unless explicitly configured.

2. **MRSA signal release context**
   - In Release section, expect compact IPC panel with signal count, high-priority count, open action count, and blocking marker when applicable.

3. **Negative/no-signal accession**
   - Expect no IPC validation warning.
   - Expect no IPC release-context panel.

4. **Rule configured with blocker**
   - For open signal on a rule with `releaseImpact: blocker`, expect release-blocking validation issue.

5. **Internal-only report visibility**
   - For rules with `reportVisibility: internal_only` (default), expect content only in internal notes, not clinician-facing report notes.

6. **Report preview regression check**
   - Existing clinician-facing report preview renders normally.
   - Internal IPC notes are labelled “Internal IPC note — not clinician-facing”.

7. **Release workflow regression check**
   - Existing release seal/amend workflows continue to work.
