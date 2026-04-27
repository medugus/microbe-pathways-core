import type { ASTResult } from "../domain/types";

/**
 * True only for untouched panel placeholder rows.
 * These rows are safe to clear in bulk and should not create false
 * "incomplete AST" release blockers.
 */
export function isTrueBlankAstRow(row: ASTResult): boolean {
  const hasNoRawValues =
    row.rawValue === undefined && row.micMgL === undefined && row.zoneMm === undefined;
  const hasNoInterpretation =
    row.rawInterpretation === undefined &&
    row.interpretedSIR === undefined &&
    row.finalInterpretation === undefined;
  const hasNoComment = !row.comment?.trim();
  const hasNoExplicitReviewMarker =
    row.governance === "draft" &&
    !row.consultantOverride &&
    !row.ruleAppliedCode &&
    (!row.expertRulesFired || row.expertRulesFired.length === 0);

  return hasNoRawValues && hasNoInterpretation && hasNoComment && hasNoExplicitReviewMarker;
}
