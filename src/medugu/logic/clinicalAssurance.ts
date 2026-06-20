import type { Accession, MeduguState } from "../domain/types";
import { ASTMethod, ReleaseState } from "../domain/enums";
import { buildAMSQueue, isRestrictedRow } from "./amsEngine";
import { evaluateIPC } from "./ipcEngine";
import { buildOutbreakSurveillanceReport } from "./outbreakEngine";
import { runValidation } from "./validationEngine";
import { deriveMicrobiologyWorklist } from "./worklistEngine";

export type ClinicalAssuranceStatus = "ready" | "watch" | "gap";

export interface ClinicalCapabilityCard {
  id: string;
  title: string;
  status: ClinicalAssuranceStatus;
  score: number;
  headline: string;
  evidence: string[];
  gaps: string[];
  nextActions: string[];
}

export interface ClinicalAssuranceMetric {
  label: string;
  value: string | number;
  detail: string;
}

export interface ClinicalAssuranceReport {
  totalScore: number;
  status: ClinicalAssuranceStatus;
  investorNarrative: string;
  headlineMetrics: ClinicalAssuranceMetric[];
  cards: ClinicalCapabilityCard[];
}

function pct(value: number, target: number): number {
  if (target <= 0) return 100;
  return Math.min(100, Math.round((value / target) * 100));
}

function average(scores: number[]): number {
  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

function statusFor(score: number): ClinicalAssuranceStatus {
  if (score >= 80) return "ready";
  if (score >= 55) return "watch";
  return "gap";
}

function countReleased(accessions: Accession[]): number {
  return accessions.filter(
    (accession) =>
      accession.release.state === ReleaseState.Released ||
      accession.release.state === ReleaseState.Amended,
  ).length;
}

function countDistinct<T>(items: T[]): number {
  return new Set(items).size;
}

function describeCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function buildClinicalAssuranceReport(state: MeduguState): ClinicalAssuranceReport {
  const accessions = Object.values(state.accessions);
  const validations = accessions.map((accession) => ({
    accession,
    validation: runValidation(accession),
  }));
  const worklist = deriveMicrobiologyWorklist(state.accessions);
  const outbreak = buildOutbreakSurveillanceReport(
    state.accessions,
    state.activeAccessionId,
  );
  const amsQueue = buildAMSQueue(state.accessions);
  const ipcReports = accessions.map((accession) => evaluateIPC(accession, state.accessions));

  const specimenFamilies = countDistinct(accessions.map((accession) => accession.specimen.familyCode));
  const specimenSubtypes = countDistinct(
    accessions.map((accession) => `${accession.specimen.familyCode}/${accession.specimen.subtypeCode}`),
  );
  const isolates = accessions.flatMap((accession) => accession.isolates);
  const astRows = accessions.flatMap((accession) => accession.ast);
  const diskDiffusionRows = astRows.filter((row) => row.method === ASTMethod.DiskDiffusion);
  const interpretedAstRows = astRows.filter(
    (row) => row.finalInterpretation || row.interpretedSIR || row.rawInterpretation,
  );
  const restrictedRows = astRows.filter(isRestrictedRow);
  const auditEvents = accessions.reduce((sum, accession) => sum + accession.audit.length, 0);
  const releasedReports = countReleased(accessions);
  const blockerCount = validations.reduce(
    (sum, entry) => sum + entry.validation.blockers.length,
    0,
  );
  const warningCount = validations.reduce(
    (sum, entry) => sum + entry.validation.warnings.length,
    0,
  );
  const criticalCommunications = validations.filter(
    (entry) => entry.validation.phoneOutRequiredPending,
  ).length;
  const ipcDecisionCount = ipcReports.reduce(
    (sum, report) => sum + report.decisions.length,
    0,
  );
  const immediateIpcCount = ipcReports.reduce(
    (sum, report) => sum + report.decisions.filter((decision) => decision.timing === "immediate").length,
    0,
  );
  const worklistCategories = Object.values(worklist.byCategory).filter((items) => items.length > 0).length;
  const versionPinsPresent = Boolean(
    state.ruleVersion.version &&
      state.breakpointVersion &&
      state.exportVersion &&
      state.buildVersion,
  );

  const cultureScore = average([
    pct(accessions.length, 20),
    pct(specimenFamilies, 7),
    pct(specimenSubtypes, 12),
    pct(worklistCategories, 6),
  ]);
  const ruleScore = average([
    versionPinsPresent ? 100 : 30,
    pct(blockerCount + warningCount, 10),
    pct(interpretedAstRows.length, Math.max(astRows.length, 1)),
    auditEvents > 0 ? 85 : 45,
  ]);
  const amsScore = average([
    restrictedRows.length > 0 ? 95 : 45,
    amsQueue.length > 0 ? 90 : 65,
    pct(astRows.length, 25),
  ]);
  const ipcScore = average([
    ipcDecisionCount > 0 ? 95 : 40,
    outbreak.summary.candidatePairCount > 0 ? 100 : 45,
    outbreak.summary.highRiskPairCount > 0 ? 95 : 60,
    immediateIpcCount > 0 ? 90 : 65,
  ]);
  const readerScore = average([
    diskDiffusionRows.length > 0 ? 90 : 40,
    pct(diskDiffusionRows.length, 18),
    state.exportVersion ? 85 : 45,
  ]);
  const commercialScore = average([
    pct(releasedReports, 6),
    auditEvents > 0 ? 90 : 45,
    versionPinsPresent ? 95 : 35,
    pct(accessions.length, 20),
  ]);

  const cards: ClinicalCapabilityCard[] = [
    {
      id: "culture-lis",
      title: "Culture LIS breadth",
      score: cultureScore,
      status: statusFor(cultureScore),
      headline: `${describeCount(accessions.length, "case")} across ${describeCount(specimenFamilies, "specimen family", "specimen families")}`,
      evidence: [
        `${describeCount(specimenSubtypes, "specimen pathway")} represented in the demo dataset.`,
        `${worklist.items.length} operational worklist item(s) derived from live accession state.`,
        "Blood culture, colonisation screen, isolate, AST, validation, release and reporting modules are linked through one accession model.",
      ],
      gaps:
        accessions.length >= 20
          ? []
          : ["Load at least 20 representative culture cases before a serious buyer demonstration."],
      nextActions: [
        "Keep the demo dataset small but intentional: common cultures, sterile sites, blood culture, MRSA/CPE/CRO screens, AMS, IPC and outbreak cases.",
        "Add site-specific specimen dictionaries during each pilot rather than hard-coding one hospital's workflow.",
      ],
    },
    {
      id: "rules-validation",
      title: "Expert rules and validation",
      score: ruleScore,
      status: statusFor(ruleScore),
      headline: `${blockerCount} blocker(s), ${warningCount} warning(s), version-pinned rules`,
      evidence: [
        versionPinsPresent
          ? `Rules ${state.ruleVersion.version}, breakpoints ${state.breakpointVersion}, export ${state.exportVersion}, build ${state.buildVersion}.`
          : "Rule, breakpoint, export or build version metadata is incomplete.",
        `${interpretedAstRows.length}/${astRows.length || 0} AST row(s) have interpreted values available.`,
        `${criticalCommunications} case(s) currently require critical-communication resolution before release.`,
      ],
      gaps:
        auditEvents > 0
          ? []
          : ["No audit events found in the current loaded state; regulated pilots need immutable audit evidence."],
      nextActions: [
        "Create a signed clinical rule register for CLSI/EUCAST, local policy and override ownership.",
        "Add regression packs for every high-risk expert rule: MRSA, VRE, CRE/CPE, ESBL, carbapenemase suspicion and sterile-site phone-out.",
      ],
    },
    {
      id: "ams",
      title: "AMS stewardship",
      score: amsScore,
      status: statusFor(amsScore),
      headline: `${restrictedRows.length} restricted AST row(s), ${amsQueue.length} pending AMS request(s)`,
      evidence: [
        "Restricted antimicrobials can be hidden from clinician-facing output until AMS approval.",
        `${amsQueue.filter((item) => item.overdue).length} AMS request(s) are overdue in the current queue.`,
        "Stewardship visibility is connected to AST rows rather than a separate note-only workflow.",
      ],
      gaps:
        restrictedRows.length > 0
          ? []
          : ["Add at least one Reserve/restricted antimicrobial case to show the AMS value clearly."],
      nextActions: [
        "Turn AMS policy into configurable hospital rules with role-based approval and escalation ownership.",
        "Add analytics for restricted release avoided, de-escalation opportunities and approval turnaround time.",
      ],
    },
    {
      id: "ipc-outbreak",
      title: "IPC and outbreak intelligence",
      score: ipcScore,
      status: statusFor(ipcScore),
      headline: `${ipcDecisionCount} IPC decision(s), ${outbreak.summary.candidatePairCount} outbreak candidate pair(s)`,
      evidence: [
        `${outbreak.summary.highRiskPairCount} high-risk outbreak pair(s) and ${outbreak.summary.totalComparableIsolates} comparable isolate(s).`,
        `${immediateIpcCount} immediate IPC escalation(s) currently fire from organism/phenotype context.`,
        "Outbreak logic links organism, ward, timing, AST concordance and phenotype flags into an IPC handoff.",
      ],
      gaps:
        outbreak.summary.candidatePairCount > 0
          ? []
          : ["Seed outbreak examples for at least MRSA and carbapenem-resistant Enterobacterales before demos."],
      nextActions: [
        "Add patient movement, bed-space and theatre/procedure overlap to raise outbreak confidence.",
        "Plan a reference-lab/WGS handoff so the app can distinguish screening suspicion from confirmed clusters.",
      ],
    },
    {
      id: "zone-reader",
      title: "Zone Reader bridge",
      score: readerScore,
      status: statusFor(readerScore),
      headline: `${diskDiffusionRows.length} disk-diffusion AST row(s) available for measurement workflows`,
      evidence: [
        "The LIMS can generate panel-scoped worklists and receive measurement-only Zone Reader payloads.",
        "Import filtering keeps off-panel and duplicate reader results visible for review rather than silently accepting them.",
        "LIS remains the authority for final interpretation unless explicitly configured otherwise.",
      ],
      gaps:
        diskDiffusionRows.length > 0
          ? []
          : ["Add disk-diffusion cases to the active dataset to demonstrate end-to-end Zone Reader handoff."],
      nextActions: [
        "Make the Zone Reader/LIMS contract a public integration specification for disc manufacturers and LIS partners.",
        "Add barcode/plate image traceability to every exported measurement package.",
      ],
    },
    {
      id: "commercial-qms",
      title: "Commercial and QMS readiness",
      score: commercialScore,
      status: statusFor(commercialScore),
      headline: `${releasedReports} released/amended report(s), ${auditEvents} audit event(s)`,
      evidence: [
        "Release packages pin rule, breakpoint, export and build versions.",
        "The prototype already separates clinical validation, report generation, IPC/AMS decisions and export.",
        "The current structure can support ISO 15189/CAP-style evidence packs once backed by controlled infrastructure.",
      ],
      gaps: [
        "This is still a prototype: buyer-grade deployment needs security review, validation data, QMS documentation and production support processes.",
      ],
      nextActions: [
        "Run a 2-site shadow pilot with frozen rules, locked datasets, audit review and discrepancy tracking.",
        "Package an investor demo around three moments: faster culture workflow, safer AMS/IPC decisions, and automated Zone Reader measurements.",
      ],
    },
  ];

  const totalScore = average(cards.map((card) => card.score));

  return {
    totalScore,
    status: statusFor(totalScore),
    investorNarrative:
      "Medugu LIMS is a culture-focused microbiology command system: it links accessioning, specimen pathways, isolate workup, AST, expert rules, AMS approvals, IPC alerts, outbreak surveillance, validation, release, PDF reporting and Zone Reader measurement exchange into one governed workflow.",
    headlineMetrics: [
      {
        label: "Culture cases",
        value: accessions.length,
        detail: `${specimenFamilies} specimen families, ${specimenSubtypes} pathways`,
      },
      {
        label: "Isolates / AST rows",
        value: `${isolates.length}/${astRows.length}`,
        detail: `${diskDiffusionRows.length} disk-diffusion rows`,
      },
      {
        label: "AMS queue",
        value: amsQueue.length,
        detail: `${restrictedRows.length} restricted AST rows`,
      },
      {
        label: "IPC/outbreak",
        value: `${ipcDecisionCount}/${outbreak.summary.candidatePairCount}`,
        detail: `${outbreak.summary.highRiskPairCount} high-risk pairs`,
      },
      {
        label: "Release evidence",
        value: releasedReports,
        detail: `${auditEvents} audit events`,
      },
    ],
    cards,
  };
}
