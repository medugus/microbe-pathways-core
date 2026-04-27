import type { Accession, ASTResult } from "../domain/types";

type MutateFn = (id: string, fn: (a: Accession) => Accession) => void;
type AppendAuditFn = (
  a: Accession,
  ev: Omit<import("../domain/types").AuditEvent, "id" | "at">,
  cloud?: {
    entity: "accession" | "isolate" | "ast" | "workflow" | "stewardship" | "release_package";
    entityId?: string | null;
  },
) => Accession;

export function createASTMutations(mutate: MutateFn, appendAudit: AppendAuditFn) {
  return {
    addAST(accessionId: string, row: ASTResult, actor = "local") {
      mutate(accessionId, (a) =>
        appendAudit(
          { ...a, ast: [...a.ast, row] },
          {
            actor,
            action: "ast.added",
            section: "ast",
            field: `ast[${row.antibioticCode}]`,
            newValue: {
              isolateId: row.isolateId,
              antibioticCode: row.antibioticCode,
              method: row.method,
              standard: row.standard,
              rawValue: row.rawValue,
              interpretation: row.finalInterpretation,
            },
          },
          { entity: "ast", entityId: row.id },
        ),
      );
    },

    updateAST(accessionId: string, astId: string, patch: Partial<ASTResult>, actor = "local") {
      mutate(accessionId, (a) => {
        const before = a.ast.find((x) => x.id === astId);
        if (!before) return a;
        const after: ASTResult = { ...before, ...patch };
        return appendAudit(
          { ...a, ast: a.ast.map((x) => (x.id === astId ? after : x)) },
          {
            actor,
            action: "ast.updated",
            section: "ast",
            field: `ast[${before.antibioticCode}]`,
            oldValue: before,
            newValue: after,
          },
          { entity: "ast", entityId: astId },
        );
      });
    },

    removeAST(accessionId: string, astId: string, actor = "local") {
      mutate(accessionId, (a) => {
        const before = a.ast.find((x) => x.id === astId);
        if (!before) return a;
        return appendAudit(
          { ...a, ast: a.ast.filter((x) => x.id !== astId) },
          {
            actor,
            action: "ast.removed",
            section: "ast",
            field: `ast[${before.antibioticCode}]`,
            oldValue: before,
          },
          { entity: "ast", entityId: astId },
        );
      });
    },

    applyExpertRules(
      accessionId: string,
      rowPatches: Record<string, Partial<import("../domain/types").ASTResult>>,
      actor = "local",
    ) {
      mutate(accessionId, (a) => {
        const next = a.ast.map((r) => (rowPatches[r.id] ? { ...r, ...rowPatches[r.id] } : r));
        return appendAudit(
          { ...a, ast: next },
          {
            actor,
            action: "ast.expertRulesApplied",
            section: "ast",
            field: "ast",
            newValue: { affected: Object.keys(rowPatches).length },
          },
          { entity: "ast", entityId: accessionId },
        );
      });
    },

    recordConsultantOverride(
      accessionId: string,
      astId: string,
      override: {
        actor: string;
        reason: string;
        toInterpretation?: import("../domain/enums").ASTInterpretation;
      },
      actor = "local",
    ) {
      mutate(accessionId, (a) => {
        const before = a.ast.find((x) => x.id === astId);
        if (!before) return a;
        const after = {
          ...before,
          finalInterpretation: override.toInterpretation ?? before.finalInterpretation,
          consultantOverride: {
            actor: override.actor,
            at: new Date().toISOString(),
            reason: override.reason,
            fromInterpretation: before.finalInterpretation,
            toInterpretation: override.toInterpretation,
          },
        };
        return appendAudit(
          { ...a, ast: a.ast.map((x) => (x.id === astId ? after : x)) },
          {
            actor,
            action: "ast.consultantOverride",
            section: "ast",
            field: `ast[${before.antibioticCode}]`,
            oldValue: before.finalInterpretation,
            newValue: after.finalInterpretation,
            reason: override.reason,
          },
          { entity: "ast", entityId: astId },
        );
      });
    },
  };
}
