import type { Accession, Isolate } from "../domain/types";

type MutateFn = (id: string, fn: (a: Accession) => Accession) => void;
type AppendAuditFn = (
  a: Accession,
  ev: Omit<import("../domain/types").AuditEvent, "id" | "at">,
  cloud?: {
    entity: "accession" | "isolate" | "ast" | "workflow" | "stewardship" | "release_package";
    entityId?: string | null;
  },
) => Accession;

export function createIsolateMutations(mutate: MutateFn, appendAudit: AppendAuditFn) {
  return {
    addIsolate(accessionId: string, iso: Isolate, actor = "local") {
      mutate(accessionId, (a) =>
        appendAudit(
          { ...a, isolates: [...a.isolates, iso] },
          {
            actor,
            action: "isolate.added",
            section: "isolate",
            field: `isolates[${iso.isolateNo}]`,
            newValue: { organismCode: iso.organismCode, significance: iso.significance },
          },
          { entity: "isolate", entityId: iso.id },
        ),
      );
    },

    updateIsolate(
      accessionId: string,
      isolateId: string,
      patch: Partial<Isolate>,
      actor = "local",
    ) {
      mutate(accessionId, (a) => {
        const before = a.isolates.find((i) => i.id === isolateId);
        if (!before) return a;
        const after: Isolate = { ...before, ...patch };
        return appendAudit(
          { ...a, isolates: a.isolates.map((i) => (i.id === isolateId ? after : i)) },
          {
            actor,
            action: "isolate.updated",
            section: "isolate",
            field: `isolates[${before.isolateNo}]`,
            oldValue: before,
            newValue: after,
          },
          { entity: "isolate", entityId: isolateId },
        );
      });
    },

    removeIsolate(accessionId: string, isolateId: string, actor = "local") {
      mutate(accessionId, (a) => {
        const before = a.isolates.find((i) => i.id === isolateId);
        if (!before) return a;
        return appendAudit(
          {
            ...a,
            isolates: a.isolates.filter((i) => i.id !== isolateId),
            ast: a.ast.filter((x) => x.isolateId !== isolateId),
          },
          {
            actor,
            action: "isolate.removed",
            section: "isolate",
            field: `isolates[${before.isolateNo}]`,
            oldValue: before,
          },
          { entity: "isolate", entityId: isolateId },
        );
      });
    },
  };
}
