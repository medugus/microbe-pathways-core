import { describe, expect, it } from "vitest";
import { DEMO_ACCESSIONS } from "../../seed/demoAccessions";
import { buildOutbreakSurveillanceReport } from "../outbreakEngine";

const accessions = Object.fromEntries(
  DEMO_ACCESSIONS.map((accession) => [accession.id, accession]),
);

describe("outbreak surveillance", () => {
  it("keeps reset-proof Klebsiella and MRSA outbreak fixtures visible", () => {
    const report = buildOutbreakSurveillanceReport(accessions);

    expect(report.summary.totalComparableIsolates).toBeGreaterThanOrEqual(7);
    expect(report.summary.candidatePairCount).toBeGreaterThan(0);
    expect(report.summary.highRiskPairCount).toBeGreaterThan(0);

    const klebsiellaPairs = report.candidatePairs.filter(
      (pair) => pair.first.organismCode === "KPNE" && pair.second.organismCode === "KPNE",
    );
    const mrsaPairs = report.candidatePairs.filter(
      (pair) => pair.first.organismCode === "SAUR" && pair.second.organismCode === "SAUR",
    );

    expect(klebsiellaPairs.length).toBeGreaterThanOrEqual(3);
    expect(mrsaPairs.length).toBeGreaterThanOrEqual(6);
  });

  it("prioritises same-ward high-concordance pairs for IPC handoff", () => {
    const report = buildOutbreakSurveillanceReport(accessions);
    const highPriority = report.candidatePairs.find(
      (pair) =>
        pair.first.organismCode === "KPNE" &&
        pair.second.organismCode === "KPNE" &&
        pair.sameWard &&
        pair.astSimilarity >= 0.9,
    );

    expect(highPriority).toBeDefined();
    expect(highPriority?.severity).toBe("high");
    expect(highPriority?.score).toBeGreaterThanOrEqual(90);
    expect(highPriority?.recommendedActions.join(" ")).toContain("IPC");
    expect(highPriority?.ipcHandoff).toContain("outbreak candidate");
  });

  it("marks active-accession linked pairs so the workspace can foreground them", () => {
    const activeAccessionId = "MB25-OUT-MRSA1";
    const report = buildOutbreakSurveillanceReport(accessions, activeAccessionId);

    expect(report.summary.activeAccessionPairCount).toBeGreaterThan(0);
    expect(report.candidatePairs[0]?.involvesActiveAccession).toBe(true);
  });
});
