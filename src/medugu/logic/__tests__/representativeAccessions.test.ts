import { describe, expect, it } from "vitest";
import type { Accession, MeduguState } from "../../domain/types";
import { WorkflowStage } from "../../domain/enums";
import { DEMO_ACCESSIONS } from "../../seed/demoAccessions";
import {
  REPRESENTATIVE_CASE_LIMIT,
  selectRepresentativeAccessions,
} from "../representativeAccessions";

const stages = Object.values(WorkflowStage);

function makeState(count: number, activeIndex: number | null = null): MeduguState {
  const accessions = Array.from({ length: count }, (_, index) => {
    const source = DEMO_ACCESSIONS[index % DEMO_ACCESSIONS.length];
    const stage = stages[index % stages.length];
    return {
      ...source,
      id: `case-${index}`,
      accessionNumber: `CASE-${index}`,
      workflowStatus: stage,
      stage,
      createdAt: new Date(2026, 0, index + 1).toISOString(),
      updatedAt: new Date(2026, 0, index + 1).toISOString(),
    } as Accession;
  });

  return {
    schemaVersion: 1,
    accessions: Object.fromEntries(
      accessions.map((accession) => [accession.id, accession]),
    ),
    accessionOrder: accessions.map((accession) => accession.id),
    activeAccessionId:
      activeIndex === null ? null : accessions[activeIndex]?.id ?? null,
    ruleVersion: {
      ruleSetId: "test",
      version: "1",
      effectiveFrom: "2026-01-01",
    },
    breakpointVersion: "test",
    exportVersion: "test",
    buildVersion: "test",
  };
}

describe("representative accession selection", () => {
  it("limits a large loaded dataset to 20 cases", () => {
    const selected = selectRepresentativeAccessions(makeState(60));

    expect(selected).toHaveLength(REPRESENTATIVE_CASE_LIMIT);
    expect(new Set(selected.map((accession) => accession.id)).size).toBe(
      REPRESENTATIVE_CASE_LIMIT,
    );
  });

  it("keeps every workflow stage represented when the source data supports it", () => {
    const selected = selectRepresentativeAccessions(makeState(60));
    const representedStages = new Set(
      selected.map((accession) => accession.workflowStatus),
    );

    for (const stage of stages) {
      expect(representedStages.has(stage)).toBe(true);
    }
  });

  it("always retains the actively viewed case", () => {
    const state = makeState(60, 0);
    const selected = selectRepresentativeAccessions(state);

    expect(selected.some((accession) => accession.id === "case-0")).toBe(true);
  });

  it("shows every case when the loaded dataset is already small", () => {
    const state = makeState(12);
    const selected = selectRepresentativeAccessions(state);

    expect(selected).toHaveLength(12);
    expect(selected[0]?.id).toBe("case-11");
  });
});
