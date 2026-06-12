import type { Accession, MeduguState } from "../domain/types";
import { ASTMethod, WorkflowStage } from "../domain/enums";

export const REPRESENTATIVE_CASE_LIMIT = 20;

const WORKFLOW_STAGE_ORDER = Object.values(WorkflowStage);

function timestamp(accession: Accession) {
  const value = new Date(accession.updatedAt || accession.createdAt).getTime();
  return Number.isFinite(value) ? value : 0;
}

function capabilityTokens(accession: Accession) {
  const tokens = new Set<string>([
    `stage:${accession.workflowStatus}`,
    `priority:${accession.priority}`,
    `specimen:${accession.specimen.familyCode}`,
    `release:${accession.release.state}`,
  ]);

  if (accession.specimen.familyCode === "BLOOD") tokens.add("blood_culture");
  if (accession.specimenAssessments.some((assessment) => !assessment.acceptable)) {
    tokens.add("specimen_rejection");
  }
  if (accession.microscopy.length > 0) tokens.add("microscopy");
  if (accession.isolates.length > 0) tokens.add("isolate");
  if (
    accession.isolates.some(
      (isolate) => isolate.mixedGrowth || isolate.significance === "mixed_growth",
    )
  ) {
    tokens.add("mixed_growth");
  }
  if (accession.ast.length > 0) tokens.add("ast");
  if (accession.ast.some((row) => row.method === ASTMethod.DiskDiffusion)) {
    tokens.add("ast_disk_diffusion");
  }
  if (
    accession.ast.some(
      (row) =>
        row.method === ASTMethod.MIC_Broth ||
        row.method === ASTMethod.MIC_Etest,
    )
  ) {
    tokens.add("ast_mic");
  }
  if (accession.ast.some((row) => (row.expertRulesFired?.length ?? 0) > 0)) {
    tokens.add("expert_rules");
  }
  if (accession.stewardship.length > 0) tokens.add("stewardship");
  if ((accession.amsApprovals?.length ?? 0) > 0) tokens.add("ams");
  if (accession.ipc.length > 0) tokens.add("ipc");
  if (accession.validation.length > 0) tokens.add("validation");
  if (accession.phoneOuts.length > 0) tokens.add("critical_communication");
  if (accession.releasePackage) tokens.add("release_package");
  if (accession.release.state === "amended") tokens.add("amendment");

  return tokens;
}

function orderedAccessions(state: MeduguState) {
  const seen = new Set<string>();
  const ordered: Accession[] = [];

  for (const id of [...state.accessionOrder].reverse()) {
    const accession = state.accessions[id];
    if (!accession || seen.has(accession.id)) continue;
    seen.add(accession.id);
    ordered.push(accession);
  }

  const unordered = Object.values(state.accessions)
    .filter((accession) => !seen.has(accession.id))
    .sort((a, b) => timestamp(b) - timestamp(a));
  ordered.push(...unordered);

  return ordered;
}

export function selectRepresentativeAccessions(
  state: MeduguState,
  limit = REPRESENTATIVE_CASE_LIMIT,
) {
  if (limit <= 0) return [] as Accession[];

  const candidates = orderedAccessions(state);
  if (candidates.length <= limit) return candidates;

  const originalIndex = new Map(
    candidates.map((accession, index) => [accession.id, index]),
  );
  const selected: Accession[] = [];
  const selectedIds = new Set<string>();
  const coveredCapabilities = new Set<string>();

  const add = (accession: Accession | undefined) => {
    if (!accession || selectedIds.has(accession.id) || selected.length >= limit) {
      return;
    }
    selected.push(accession);
    selectedIds.add(accession.id);
    for (const token of capabilityTokens(accession)) coveredCapabilities.add(token);
  };

  add(
    state.activeAccessionId
      ? state.accessions[state.activeAccessionId]
      : undefined,
  );

  // First guarantee broad workflow-stage coverage.
  for (const stage of WORKFLOW_STAGE_ORDER) {
    if (selected.length >= limit) break;
    if (selected.some((accession) => accession.workflowStatus === stage)) continue;

    const bestForStage = candidates
      .filter(
        (accession) =>
          accession.workflowStatus === stage && !selectedIds.has(accession.id),
      )
      .sort((a, b) => {
        const capabilityDifference =
          capabilityTokens(b).size - capabilityTokens(a).size;
        return capabilityDifference || timestamp(b) - timestamp(a);
      })[0];
    add(bestForStage);
  }

  const frequencies = new Map<string, number>();
  for (const accession of candidates) {
    for (const token of capabilityTokens(accession)) {
      frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
    }
  }

  // Fill the remaining slots with cases that add the rarest uncovered
  // capabilities. This keeps the compact view useful as a feature showcase.
  while (selected.length < limit) {
    let best: Accession | undefined;
    let bestScore = -1;

    for (const accession of candidates) {
      if (selectedIds.has(accession.id)) continue;

      let score = 0;
      for (const token of capabilityTokens(accession)) {
        if (coveredCapabilities.has(token)) continue;
        score += 1 / (frequencies.get(token) ?? 1);
      }

      if (
        score > bestScore ||
        (score === bestScore &&
          best &&
          (originalIndex.get(accession.id) ?? Number.MAX_SAFE_INTEGER) <
            (originalIndex.get(best.id) ?? Number.MAX_SAFE_INTEGER))
      ) {
        best = accession;
        bestScore = score;
      }
    }

    if (!best) break;
    add(best);
  }

  return selected.sort(
    (a, b) =>
      (originalIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (originalIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  );
}

export function representativeAccessionMap(
  state: MeduguState,
  limit = REPRESENTATIVE_CASE_LIMIT,
) {
  return Object.fromEntries(
    selectRepresentativeAccessions(state, limit).map((accession) => [
      accession.id,
      accession,
    ]),
  );
}
