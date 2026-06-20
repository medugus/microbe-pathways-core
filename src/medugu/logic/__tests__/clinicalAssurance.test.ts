import { describe, expect, it } from "vitest";
import type { MeduguState } from "../../domain/types";
import { DEMO_ACCESSIONS } from "../../seed/demoAccessions";
import { buildClinicalAssuranceReport } from "../clinicalAssurance";

function makeDemoState(): MeduguState {
  return {
    schemaVersion: 1,
    accessions: Object.fromEntries(
      DEMO_ACCESSIONS.map((accession) => [accession.id, accession]),
    ),
    accessionOrder: DEMO_ACCESSIONS.map((accession) => accession.id),
    activeAccessionId: DEMO_ACCESSIONS[0]?.id ?? null,
    ruleVersion: {
      ruleSetId: "medugu-demo",
      version: "2026.1",
      effectiveFrom: "2026-01-01",
    },
    breakpointVersion: "EUCAST-2026.1",
    exportVersion: "1.0.0",
    buildVersion: "test",
  };
}

describe("clinical assurance report", () => {
  it("summarises the LIMS investor capability evidence", () => {
    const report = buildClinicalAssuranceReport(makeDemoState());

    expect(report.totalScore).toBeGreaterThan(50);
    expect(report.cards.map((card) => card.id)).toEqual([
      "culture-lis",
      "rules-validation",
      "ams",
      "ipc-outbreak",
      "zone-reader",
      "commercial-qms",
    ]);
    expect(report.investorNarrative).toContain("AMS approvals");
    expect(report.investorNarrative).toContain("outbreak surveillance");
    expect(report.headlineMetrics.some((metric) => metric.label === "IPC/outbreak")).toBe(true);
  });

  it("keeps capability scores bounded and statused", () => {
    const report = buildClinicalAssuranceReport(makeDemoState());

    for (const card of report.cards) {
      expect(card.score).toBeGreaterThanOrEqual(0);
      expect(card.score).toBeLessThanOrEqual(100);
      expect(["ready", "watch", "gap"]).toContain(card.status);
      expect(card.nextActions.length).toBeGreaterThan(0);
    }
  });
});
