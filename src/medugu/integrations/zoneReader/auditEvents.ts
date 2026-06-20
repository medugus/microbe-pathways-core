// Zone Reader audit events.
//
// These are routed through the same durable append-only audit pipeline as
// release, IPC and AMS actions. The console trace remains as a developer aid,
// but the authoritative sink is public.audit_event via store/cloudAudit.ts.

import { recordAuditAsync } from "../../store/cloudAudit";

export type ZoneReaderAuditCode =
  | "ZONE_READER_WORKLIST_EXPORTED"
  | "ZONE_READER_WORKLIST_SENT"
  | "ZONE_READER_RESULT_IMPORT_PARSED"
  | "ZONE_READER_RESULT_IMPORT_REJECTED"
  | "ZONE_READER_ROW_ACCEPTED"
  | "ZONE_READER_ROW_REJECTED"
  | "ZONE_READER_ROW_OVERRIDDEN"
  | "ZONE_READER_MISSING_ROWS_CREATED"
  | "ZONE_READER_RECEIPT_ACCEPTED"
  | "ZONE_READER_RECEIPT_REJECTED";

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
  recordAuditAsync({
    action: full.code,
    entity: "zone_reader",
    entityId: full.isolateId ?? full.accessionId,
    accessionId: full.accessionId,
    sourceModule: "zone_reader",
    actorLabel: full.actor ?? null,
    field: full.antibioticCode ? `zoneReader[${full.antibioticCode}]` : null,
    newValue: {
      isolateId: full.isolateId,
      astPanelId: full.astPanelId,
      antibioticCode: full.antibioticCode,
      detail: full.detail ?? null,
    },
    payload: {
      zoneReaderEvent: full,
    },
  });
  if (typeof console !== "undefined") {
    // eslint-disable-next-line no-console
    console.debug("[zone-reader-audit]", full);
  }
  return full;
}
