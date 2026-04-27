import type { Accession, AuditEvent } from "../domain/types";

export type RecordAuditInput = {
  action: string;
  entity: "accession" | "isolate" | "ast" | "workflow" | "stewardship" | "release_package";
  entityId?: string | null;
  field?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
  actorLabel?: string | null;
};

export type RecordAuditFn = (input: RecordAuditInput) => void;
export type NewIdFn = (prefix: string) => string;

export function createAppendAudit(recordAudit: RecordAuditFn, createId: NewIdFn) {
  return function appendAudit(
    a: Accession,
    ev: Omit<AuditEvent, "id" | "at">,
    cloud?: { entity: RecordAuditInput["entity"]; entityId?: string | null },
  ): Accession {
    recordAudit({
      action: ev.action,
      entity: cloud?.entity ?? "accession",
      entityId: cloud?.entityId ?? a.id,
      field: ev.field ?? null,
      oldValue: ev.oldValue,
      newValue: ev.newValue,
      reason: ev.reason ?? null,
      actorLabel: ev.actor ?? null,
    });
    return {
      ...a,
      audit: [...a.audit, { id: createId("aud"), at: new Date().toISOString(), ...ev }],
    };
  };
}
