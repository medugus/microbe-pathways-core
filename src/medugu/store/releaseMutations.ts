import type { Accession, AuditEvent, PhoneOutEvent, ReleasePackage } from "../domain/types";
import type { WorkflowStage, ReleaseState } from "../domain/enums";

type MutateFn = (id: string, fn: (a: Accession) => Accession) => void;
type AppendAuditFn = (
  a: Accession,
  ev: Omit<AuditEvent, "id" | "at">,
  cloud?: {
    entity: "accession" | "isolate" | "ast" | "workflow" | "stewardship" | "release_package";
    entityId?: string | null;
  },
) => Accession;
type RecordAuditFn = (input: {
  action: string;
  entity: "accession" | "isolate" | "ast" | "workflow" | "stewardship" | "release_package";
  entityId?: string | null;
  field?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
  actorLabel?: string | null;
}) => void;

export function createReleaseMutations(
  mutate: MutateFn,
  appendAudit: AppendAuditFn,
  recordAudit: RecordAuditFn,
) {
  return {
    setWorkflowStage(accessionId: string, to: WorkflowStage, audit: AuditEvent) {
      mutate(accessionId, (a) => ({
        ...a,
        workflowStatus: to,
        stage: to,
        audit: [...a.audit, audit],
      }));
      recordAudit({
        action: audit.action,
        entity: "workflow",
        entityId: accessionId,
        field: audit.field ?? "workflowStatus",
        oldValue: audit.oldValue,
        newValue: audit.newValue,
        reason: audit.reason ?? null,
        actorLabel: audit.actor ?? null,
      });
    },

    recordPhoneOut(accessionId: string, evt: PhoneOutEvent, actor = "local") {
      mutate(accessionId, (a) =>
        appendAudit(
          { ...a, phoneOuts: [...a.phoneOuts, evt] },
          {
            actor,
            action: "phoneOut.recorded",
            section: "release",
            field: "phoneOuts",
            newValue: {
              recipient: evt.recipient,
              reasonCode: evt.reasonCode,
              acknowledged: evt.acknowledged,
            },
          },
          { entity: "release_package", entityId: accessionId },
        ),
      );
    },

    finaliseRelease(
      accessionId: string,
      pkg: ReleasePackage,
      nextState: ReleaseState,
      actor = "local",
    ) {
      mutate(accessionId, (a) =>
        appendAudit(
          {
            ...a,
            releasePackage: pkg,
            release: {
              ...a.release,
              state: nextState,
              releasedAt: new Date().toISOString(),
              releasedBy: actor,
              reportVersion: pkg.version,
            },
            releasedAt: new Date().toISOString(),
            releasingActor: actor,
          },
          {
            actor,
            action: "release.finalised",
            section: "release",
            field: "release.state",
            oldValue: a.release.state,
            newValue: nextState,
          },
          { entity: "release_package", entityId: accessionId },
        ),
      );
    },

    recordConsultantApproval(
      accessionId: string,
      approval: { approvedBy: string; reason?: string },
      actor = "local",
    ) {
      mutate(accessionId, (a) =>
        appendAudit(
          {
            ...a,
            release: {
              ...a.release,
              consultantApproval: {
                approvedBy: approval.approvedBy,
                approvedAt: new Date().toISOString(),
                reason: approval.reason,
              },
            },
          },
          {
            actor,
            action: "release.consultantApproved",
            section: "release",
            field: "release.consultantApproval",
            newValue: { approvedBy: approval.approvedBy, reason: approval.reason },
          },
          { entity: "release_package", entityId: accessionId },
        ),
      );
    },
  };
}
