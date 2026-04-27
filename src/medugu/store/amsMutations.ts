import type { Accession, AMSApprovalRequest } from "../domain/types";

type MutateFn = (id: string, fn: (a: Accession) => Accession) => void;
type AppendAuditFn = (
  a: Accession,
  ev: Omit<import("../domain/types").AuditEvent, "id" | "at">,
  cloud?: {
    entity: "accession" | "isolate" | "ast" | "workflow" | "stewardship" | "release_package";
    entityId?: string | null;
  },
) => Accession;

export function createAMSMutations(mutate: MutateFn, appendAudit: AppendAuditFn) {
  return {
    requestAMSApproval(accessionId: string, req: AMSApprovalRequest, actor = "local") {
      mutate(accessionId, (a) => {
        const list = [...(a.amsApprovals ?? []), req];
        return appendAudit(
          { ...a, amsApprovals: list },
          {
            actor,
            action: "ams.requested",
            section: "stewardship",
            field: `amsApprovals[${req.antibioticCode}]`,
            newValue: {
              astId: req.astId,
              antibioticCode: req.antibioticCode,
              dueBy: req.dueBy,
              requestedBy: req.requested?.actor,
              note: req.requested?.note,
            },
          },
          { entity: "stewardship", entityId: req.id },
        );
      });
    },

    decideAMSApproval(
      accessionId: string,
      requestId: string,
      decision: { status: "approved" | "denied"; actor: string; note?: string },
    ) {
      mutate(accessionId, (a) => {
        const list = a.amsApprovals ?? [];
        const before = list.find((r) => r.id === requestId);
        if (!before) return a;
        const after: AMSApprovalRequest = {
          ...before,
          status: decision.status,
          decided: {
            at: new Date().toISOString(),
            actor: decision.actor,
            note: decision.note,
          },
        };
        return appendAudit(
          {
            ...a,
            amsApprovals: list.map((r) => (r.id === requestId ? after : r)),
          },
          {
            actor: decision.actor,
            action: decision.status === "approved" ? "ams.approved" : "ams.denied",
            section: "stewardship",
            field: `amsApprovals[${before.antibioticCode}]`,
            oldValue: { status: before.status },
            newValue: { status: after.status, note: decision.note },
            reason: decision.note,
          },
          { entity: "stewardship", entityId: requestId },
        );
      });
    },

    expireAMSApproval(accessionId: string, requestId: string, actor = "system") {
      mutate(accessionId, (a) => {
        const list = a.amsApprovals ?? [];
        const before = list.find((r) => r.id === requestId);
        if (!before || before.status !== "pending") return a;
        const after: AMSApprovalRequest = {
          ...before,
          status: "expired",
          expired: { at: new Date().toISOString(), actor },
        };
        return appendAudit(
          {
            ...a,
            amsApprovals: list.map((r) => (r.id === requestId ? after : r)),
          },
          {
            actor,
            action: "ams.expired",
            section: "stewardship",
            field: `amsApprovals[${before.antibioticCode}]`,
            oldValue: { status: before.status },
            newValue: { status: after.status },
          },
          { entity: "stewardship", entityId: requestId },
        );
      });
    },

    escalateAMSApproval(accessionId: string, requestId: string, actor = "system", note?: string) {
      mutate(accessionId, (a) => {
        const list = a.amsApprovals ?? [];
        const before = list.find((r) => r.id === requestId);
        if (!before || before.escalated) return a;
        const after: AMSApprovalRequest = { ...before, escalated: true };
        return appendAudit(
          {
            ...a,
            amsApprovals: list.map((r) => (r.id === requestId ? after : r)),
          },
          {
            actor,
            action: "ams.escalated",
            section: "stewardship",
            field: `amsApprovals[${before.antibioticCode}]`,
            newValue: { escalated: true },
            reason: note,
          },
          { entity: "stewardship", entityId: requestId },
        );
      });
    },
  };
}
