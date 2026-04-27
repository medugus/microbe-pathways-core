import type { Accession } from "../../domain/types";
import { SPECIMEN_FAMILIES } from "../../config/specimenFamilies";
import { approvalStatusForRow, isRestrictedRow, latestApprovalForRow } from "../amsEngine";
import { deriveColonisationContext, isColonisationScreen } from "../ipcColonisation";
import { evaluateIPC } from "../ipcEngine";
import { deriveLocalOutbreakWatch } from "../ipcLocalWatch";
import { isAMSReleaseRelevantASTResult } from "../stewardshipEngine";
import { runValidation } from "../validationEngine";
import { describeOperationalDashboardLimitations } from "./dashboardLimitations";
import {
  normaliseAccessions,
  toAgeHours,
  toPatientLabel,
  toSpecimenLabel,
} from "./dashboardMetrics";
import { toOperationalQueueItem } from "./dashboardNavigation";
import { sortOperationalQueueItems } from "./dashboardPriority";
import type { OperationalQueueItem, OperationalQueueItemDraft } from "./dashboardTypes";

const HIGH_PRIORITY_IPC_RULE_CODES = new Set([
  "CRE_ALERT",
  "CRAB_ALERT",
  "CRPA_ALERT",
  "VRE_ALERT",
  "MRSA_ALERT",
  "CAURIS_ALERT",
  "CDI_ALERT",
  "ESBL_INVASIVE_ALERT",
]);

const STERILE_SITE_KEYWORD_RE =
  /(sterile|csf|pleural|ascitic|synovial|pericardial|spa|image_guided)/i;

function isSterileSite(accession: Accession): boolean {
  const family = SPECIMEN_FAMILIES.find((f) => f.code === accession.specimen.familyCode);
  const subtype = family?.subtypes.find((s) => s.code === accession.specimen.subtypeCode);
  if (subtype?.tags?.includes("sterile_site")) return true;

  const haystack = `${accession.specimen.familyCode} ${accession.specimen.subtypeCode} ${accession.specimen.freeTextLabel ?? ""}`;
  return STERILE_SITE_KEYWORD_RE.test(haystack);
}

function hasPositiveBloodCulture(accession: Accession): boolean {
  if (accession.specimen.familyCode !== "BLOOD") return false;
  return accession.isolates.some(
    (iso) =>
      iso.organismCode !== "NOGRO" ||
      (iso.bottleResults ?? []).some((bottle) => bottle.growth === "growth"),
  );
}

function hasSignificantResult(accession: Accession): boolean {
  return accession.isolates.some(
    (iso) => iso.significance === "significant" && iso.organismCode !== "NOGRO",
  );
}

function pushItem(queue: OperationalQueueItem[], item: OperationalQueueItemDraft) {
  queue.push(toOperationalQueueItem(item));
}

export function deriveOperationalQueueItems(
  accessions: Record<string, Accession> | Accession[],
): OperationalQueueItem[] {
  const loaded = normaliseAccessions(accessions);
  const byId = Object.fromEntries(loaded.map((a) => [a.id, a]));
  const queue: OperationalQueueItem[] = [];

  for (const accession of loaded) {
    const validation = runValidation(accession);
    const ipc = evaluateIPC(accession, byId);
    const colonisation = deriveColonisationContext(accession, byId);
    const ageHours = toAgeHours(accession);

    const hasPhoneOutRequirement = validation.phoneOutRequiredPending;
    const hasCriticalPriority = accession.priority === "stat" || accession.priority === "urgent";
    const isCsf = /csf/i.test(
      `${accession.specimen.subtypeCode} ${accession.specimen.freeTextLabel ?? ""}`,
    );
    const positiveBlood = hasPositiveBloodCulture(accession);
    const hasHighRiskIpcSignal = ipc.decisions.some((d) =>
      HIGH_PRIORITY_IPC_RULE_CODES.has(d.ruleCode),
    );

    if (
      hasPhoneOutRequirement ||
      positiveBlood ||
      isCsf ||
      (isSterileSite(accession) && hasHighRiskIpcSignal) ||
      (hasCriticalPriority && hasSignificantResult(accession))
    ) {
      pushItem(queue, {
        id: `${accession.id}:critical-result`,
        accessionId: accession.id,
        accessionNumber: accession.accessionNumber,
        patientLabel: toPatientLabel(accession),
        ward: accession.patient.ward,
        specimenLabel: toSpecimenLabel(accession),
        organismOrPhenotype: accession.isolates.find((i) => i.organismCode !== "NOGRO")
          ?.organismDisplay,
        category: "critical_result",
        priority: "critical",
        reason: validation.phoneOutRequiredPending
          ? "Critical communication pathway flagged this accession and phone-out remains pending."
          : positiveBlood
            ? "Positive blood culture requires urgent review and escalation."
            : isCsf
              ? "CSF specimen requires urgent consultant-facing review."
              : "Sterile-site high-risk signal requires urgent escalation.",
        recommendedAction:
          "Prioritise immediate review, confirm critical communication completion, and progress urgent clinical escalation.",
        ownerRole: "mixed",
        dueLabel: "Immediate",
        ageHours,
        sourceModule: "Validation",
        limitationNote: describeOperationalDashboardLimitations(),
      });
    }

    if (validation.blockers.length > 0) {
      pushItem(queue, {
        id: `${accession.id}:release-blocker`,
        accessionId: accession.id,
        accessionNumber: accession.accessionNumber,
        patientLabel: toPatientLabel(accession),
        ward: accession.patient.ward,
        specimenLabel: toSpecimenLabel(accession),
        category: "release_blocker",
        priority: "high",
        reason: `${validation.blockers.length} validation blocker(s) currently prevent release.`,
        recommendedAction: "Resolve blocking validation/release requirements before final release.",
        ownerRole: "senior_scientist",
        dueLabel: "Overdue until resolved",
        ageHours,
        sourceModule: "Release",
        limitationNote: describeOperationalDashboardLimitations(),
      });
    }

    const unacknowledgedPhoneOut = accession.phoneOuts.some((p) => !p.acknowledged);
    if (validation.phoneOutRequiredPending || unacknowledgedPhoneOut) {
      pushItem(queue, {
        id: `${accession.id}:phone-out`,
        accessionId: accession.id,
        accessionNumber: accession.accessionNumber,
        patientLabel: toPatientLabel(accession),
        ward: accession.patient.ward,
        specimenLabel: toSpecimenLabel(accession),
        category: "phone_out",
        priority: "high",
        reason: validation.phoneOutRequiredPending
          ? "Phone-out is required and not documented as acknowledged."
          : "At least one phone-out event remains unacknowledged.",
        recommendedAction:
          "Document and acknowledge phone-out communication with clinician recipient.",
        ownerRole: "senior_scientist",
        dueLabel: "Immediate",
        ageHours,
        sourceModule: "Release",
        limitationNote: describeOperationalDashboardLimitations(),
      });
    }

    if (validation.consultantApprovalPending || (isCsf && !accession.release.consultantApproval)) {
      pushItem(queue, {
        id: `${accession.id}:consultant-approval`,
        accessionId: accession.id,
        accessionNumber: accession.accessionNumber,
        patientLabel: toPatientLabel(accession),
        ward: accession.patient.ward,
        specimenLabel: toSpecimenLabel(accession),
        category: "consultant_approval",
        priority: "high",
        reason: "Consultant approval is pending before release completion.",
        recommendedAction: "Record consultant microbiologist approval/sign-off prior to release.",
        ownerRole: "consultant_microbiologist",
        ageHours,
        sourceModule: "Release",
        limitationNote: describeOperationalDashboardLimitations(),
      });
    }

    for (const decision of ipc.decisions) {
      const organism = accession.isolates.find(
        (iso) => iso.id === decision.isolateId,
      )?.organismDisplay;
      const phenotype = decision.phenotypes.join(", ");
      const organismOrPhenotype = [organism, phenotype].filter(Boolean).join(" · ") || undefined;
      const highPriority =
        HIGH_PRIORITY_IPC_RULE_CODES.has(decision.ruleCode) ||
        decision.timing === "immediate" ||
        decision.timing === "same_shift";

      pushItem(queue, {
        id: `${accession.id}:ipc:${decision.ruleCode}:${decision.isolateId}`,
        accessionId: accession.id,
        accessionNumber: accession.accessionNumber,
        patientLabel: toPatientLabel(accession),
        ward: accession.patient.ward,
        specimenLabel: toSpecimenLabel(accession),
        organismOrPhenotype,
        category: highPriority ? "ipc_high_priority" : "ipc_action",
        priority: highPriority ? "high" : "review",
        reason: decision.message,
        recommendedAction:
          decision.actions.length > 0
            ? `Execute IPC actions: ${decision.actions.join(", ").replaceAll("_", " ")}.`
            : "Review IPC context and complete relevant preventive controls.",
        ownerRole: "ipc_officer",
        dueLabel:
          decision.timing === "immediate"
            ? "Immediate"
            : decision.timing === "same_shift"
              ? "Same shift"
              : decision.timing === "within_24h"
                ? "Within 24h"
                : "Routine",
        ageHours,
        sourceModule: "IPC",
        limitationNote: describeOperationalDashboardLimitations(),
      });
    }

    const restrictedRows = accession.ast.filter(
      (row) => isRestrictedRow(row) && isAMSReleaseRelevantASTResult(accession, row),
    );
    for (const row of restrictedRows) {
      const status = approvalStatusForRow(accession, row.id);
      if (status === "approved") continue;
      const latest = latestApprovalForRow(accession, row.id);
      const isPending = status === "pending";
      pushItem(queue, {
        id: `${accession.id}:ams:${row.id}`,
        accessionId: accession.id,
        accessionNumber: accession.accessionNumber,
        patientLabel: toPatientLabel(accession),
        ward: accession.patient.ward,
        specimenLabel: toSpecimenLabel(accession),
        organismOrPhenotype: accession.isolates.find((iso) => iso.id === row.isolateId)
          ?.organismDisplay,
        category: isPending ? "ams_pending_approval" : "ams_restricted",
        priority: isPending ? "high" : "review",
        reason: isPending
          ? `Restricted antimicrobial ${row.antibioticCode} is pending AMS approval.`
          : `Restricted antimicrobial ${row.antibioticCode} is not yet approved (status: ${status}).`,
        recommendedAction: isPending
          ? "AMS pharmacist to approve/deny request and document decision note."
          : "Request AMS approval for restricted antimicrobial before clinical visibility.",
        ownerRole: "ams_pharmacist",
        dueLabel: latest?.dueBy
          ? new Date(latest.dueBy).getTime() < Date.now()
            ? "Overdue AMS"
            : "AMS due"
          : undefined,
        ageHours,
        sourceModule: "AMS",
        limitationNote: describeOperationalDashboardLimitations(),
      });
    }

    if (colonisation.isScreen) {
      const incompleteClearance =
        colonisation.episodeStatus === "clearance_attempt" &&
        typeof colonisation.clearanceCount === "number" &&
        typeof colonisation.clearanceRequired === "number" &&
        colonisation.clearanceCount < colonisation.clearanceRequired;
      const positiveScreen = colonisation.screenResult === "positive";

      if (positiveScreen || incompleteClearance) {
        pushItem(queue, {
          id: `${accession.id}:colonisation-follow-up`,
          accessionId: accession.id,
          accessionNumber: accession.accessionNumber,
          patientLabel: toPatientLabel(accession),
          ward: accession.patient.ward,
          specimenLabel: toSpecimenLabel(accession),
          organismOrPhenotype: colonisation.targetOrganism,
          category: "colonisation_follow_up",
          priority:
            positiveScreen && /auris/i.test(colonisation.targetOrganism ?? "") ? "high" : "review",
          reason: positiveScreen
            ? "Positive colonisation screen requires IPC follow-up and precaution review."
            : `Clearance incomplete (${colonisation.clearanceCount}/${colonisation.clearanceRequired} negative screens).`,
          recommendedAction:
            colonisation.nextAction ??
            "Continue colonisation follow-up workflow and schedule next required screen.",
          ownerRole: "ipc_officer",
          dueLabel: positiveScreen ? "Same shift" : "Follow-up due",
          ageHours,
          sourceModule: isColonisationScreen(accession) ? "IPC" : "Specimen",
          limitationNote: colonisation.limitationNote ?? describeOperationalDashboardLimitations(),
        });
      }
    }

    for (const warning of validation.warnings) {
      pushItem(queue, {
        id: `${accession.id}:validation-warning:${warning.code}`,
        accessionId: accession.id,
        accessionNumber: accession.accessionNumber,
        patientLabel: toPatientLabel(accession),
        ward: accession.patient.ward,
        specimenLabel: toSpecimenLabel(accession),
        category: "validation_warning",
        priority: "review",
        reason: warning.message,
        recommendedAction: "Review warning and complete remediation where clinically required.",
        ownerRole: "bench_scientist",
        ageHours,
        sourceModule: "Validation",
        limitationNote: describeOperationalDashboardLimitations(),
      });
    }
  }

  if (loaded.length > 0) {
    const reference = loaded[0];
    const watch = deriveLocalOutbreakWatch(reference, byId);
    for (const item of watch.signalItems) {
      pushItem(queue, {
        id: `outbreak-watch:${item.id}`,
        accessionId: item.relatedAccessions[0] ?? reference.id,
        accessionNumber: item.relatedAccessions[0],
        patientLabel: `Cluster (${item.patientAdjustedCount} cases)`,
        ward: item.ward,
        specimenLabel: `Window ${item.windowDays}d`,
        organismOrPhenotype:
          [item.organismLabel, item.phenotypeLabel].filter(Boolean).join(" / ") || undefined,
        category: "ipc_outbreak_watch",
        priority: item.severity === "high" ? "high" : "review",
        reason: item.triggerSummary,
        recommendedAction: item.recommendedAction,
        ownerRole: "ipc_officer",
        dueLabel: item.severity === "high" ? "Immediate IPC huddle" : "Cluster review",
        sourceModule: "IPC",
        limitationNote: item.limitationNote,
      });
    }
  }

  return sortOperationalQueueItems(queue);
}
