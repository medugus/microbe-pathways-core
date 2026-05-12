// Zone Reader audit-event placeholders.
//
// Skeleton only — wires intent + payload shapes. Persistence is delegated to
// the existing audit pipeline (see store/cloudAudit.ts). For now the helpers
// console.log so the integration can be exercised end-to-end without a DB
// migration; swap the body for cloudAudit.recordEvent(...) once the event
// codes below are added to the audit_event registry.

export type ZoneReaderAuditCode =
  | "ZONE_READER_WORKLIST_EXPORTED"
  | "ZONE_READER_RESULT_IMPORT_PARSED"
  | "ZONE_READER_RESULT_IMPORT_REJECTED"
  | "ZONE_READER_ROW_ACCEPTED"
  | "ZONE_READER_ROW_REJECTED"
  | "ZONE_READER_ROW_OVERRIDDEN";

export interface ZoneReaderAuditEvent {
  code: ZoneReaderAuditCode;
  accessionId: string;
  isolateId?: string;
  astPanelId?: string;
  antibioticCode?: string;
  actor?: string;
  at: string;
  detail?: Record<string, unknown>;
}

export function emitZoneReaderAudit(event: Omit<ZoneReaderAuditEvent, "at"> & { at?: string }): ZoneReaderAuditEvent {
  const full: ZoneReaderAuditEvent = { at: new Date().toISOString(), ...event };
  // Placeholder sink. Replace with cloudAudit pipeline when wiring the live integration.
  if (typeof console !== "undefined") {
    // eslint-disable-next-line no-console
    console.debug("[zone-reader-audit]", full);
  }
  return full;
}
