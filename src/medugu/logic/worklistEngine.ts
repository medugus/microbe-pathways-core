import type { Accession, MeduguState } from "../domain/types";
import { ReleaseState } from "../domain/enums";
import { approvalStatusForRow, isRestrictedRow, latestApprovalForRow } from "./amsEngine";
import { evaluateIPC } from "./ipcEngine";
import { runValidation } from "./validationEngine";
import { getBottleResults, isPositiveBottle } from "./bloodBottles";

export type WorklistQueueCategory =
  | "positive_blood_culture"
  | "ast_pending"
  | "release_blocked"
  | "ams_approval"
  | "ipc_signal"
  | "critical_communication"
  | "ready_for_review"
  | "recently_released";

export type WorklistPriority = "Critical" | "High" | "Moderate" | "Routine";

export interface MicrobiologyWorklistItem {
  accessionId: string;
  accessionNumber: string;
  patientDisplay: string;
  specimen: string;
  queueCategory: WorklistQueueCategory;
  priority: WorklistPriority;
  reason: string;
  nextAction: string;
  status: string;
  timestamp?: string;
  linkedSectionTarget?: string;
}

export interface MicrobiologyWorklist {
  items: MicrobiologyWorklistItem[];
  byCategory: Record<WorklistQueueCategory, MicrobiologyWorklistItem[]>;
}

const PRIORITY_ORDER: Record<WorklistPriority, number> = {
  Critical: 0,
  High: 1,
  Moderate: 2,
  Routine: 3,
};

function patientLabel(a: Accession): string {
  const display = [a.patient.givenName, a.patient.familyName].filter(Boolean).join(" ").trim();
  return display || a.patient.mrn || "Unknown patient";
}

function specimenLabel(a: Accession): string {
  return `${a.specimen.familyCode}/${a.specimen.subtypeCode}`;
}

function isReleasedState(a: Accession): boolean {
  return a.release.state === ReleaseState.Released || a.release.state === ReleaseState.Amended;
}

function compareItems(a: MicrobiologyWorklistItem, b: MicrobiologyWorklistItem): number {
  const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  if (p !== 0) return p;

  const at = a.timestamp ? new Date(a.timestamp).getTime() : 0;
  const bt = b.timestamp ? new Date(b.timestamp).getTime() : 0;
  if (at !== bt) return bt - at;

  return a.accessionNumber.localeCompare(b.accessionNumber);
}

function bucket(items: MicrobiologyWorklistItem[]): Record<WorklistQueueCategory, MicrobiologyWorklistItem[]> {
  const byCategory: Record<WorklistQueueCategory, MicrobiologyWorklistItem[]> = {
    positive_blood_culture: [],
    ast_pending: [],
    release_blocked: [],
    ams_approval: [],
    ipc_signal: [],
    critical_communication: [],
    ready_for_review: [],
    recently_released: [],
  };

  for (const item of items) byCategory[item.queueCategory].push(item);
  for (const key of Object.keys(byCategory) as WorklistQueueCategory[]) {
    byCategory[key].sort(compareItems);
  }

  return byCategory;
}

function hasMeaningfulCaseData(a: Accession): boolean {
  return a.microscopy.length > 0 || a.isolates.length > 0 || a.ast.length > 0 || a.phoneOuts.length > 0;
}

function buildItem(a: Accession, entry: Omit<MicrobiologyWorklistItem, "accessionId" | "accessionNumber" | "patientDisplay" | "specimen">): MicrobiologyWorklistItem {
  return {
    accessionId: a.id,
    accessionNumber: a.accessionNumber,
    patientDisplay: patientLabel(a),
    specimen: specimenLabel(a),
    ...entry,
  };
}

export function deriveMicrobiologyWorklist(accessions: MeduguState["accessions"]): MicrobiologyWorklist {
  const items: MicrobiologyWorklistItem[] = [];

  for (const accession of Object.values(accessions)) {
    const validation = runValidation(accession);

    if (accession.specimen.familyCode === "BLOOD") {
      const positiveBottles = getBottleResults(accession).filter(isPositiveBottle);
      if (positiveBottles.length > 0) {
        const linkedBottleCount = accession.isolates.reduce((count, iso) => count + (iso.bloodSourceLinks?.length ?? 0), 0);
        const hasUnlinkedSources = linkedBottleCount < positiveBottles.length;
        const hasOrganismIdentified = accession.isolates.some((iso) => iso.organismCode !== "NOGRO");
        const gramMissing = accession.microscopy.length === 0;
        const astMissing = accession.isolates.some(
          (iso) => iso.organismCode !== "NOGRO" && accession.ast.every((row) => row.isolateId !== iso.id),
        );

        const missingBits = [
          hasUnlinkedSources ? "source linkage" : null,
          gramMissing ? "Gram stain" : null,
          !hasOrganismIdentified ? "organism ID" : null,
          astMissing ? "AST" : null,
        ].filter(Boolean);

        items.push(
          buildItem(accession, {
            queueCategory: "positive_blood_culture",
            priority: hasUnlinkedSources ? "High" : "Moderate",
            reason: `Positive blood culture bottle(s): ${positiveBottles.length}${missingBits.length > 0 ? `; missing ${missingBits.join(", ")}` : ""}.`,
            nextAction: hasUnlinkedSources
              ? "Link organism isolates to positive source bottles."
              : "Complete isolate workup and AST if required.",
            status: hasUnlinkedSources ? "Needs source linkage" : "Growth detected",
            timestamp: positiveBottles.map((b) => b.positiveAt).filter(Boolean).sort().at(-1),
            linkedSectionTarget: "isolate",
          }),
        );
      }
    }

    const astMissingRows = accession.ast.filter((row) => row.rawValue == null);
    const astNoInterpretation = accession.ast.filter(
      (row) => row.rawValue != null && !row.finalInterpretation,
    );
    const isolatesWithoutAst = accession.isolates.filter(
      (iso) => iso.organismCode !== "NOGRO" && accession.ast.every((row) => row.isolateId !== iso.id),
    );
    if (isolatesWithoutAst.length > 0 || astMissingRows.length > 0 || astNoInterpretation.length > 0) {
      const reasonParts: string[] = [];
      if (isolatesWithoutAst.length > 0) {
        reasonParts.push(`${isolatesWithoutAst.length} isolate(s) with no AST panel`);
      }
      if (astMissingRows.length > 0) {
        reasonParts.push(`${astMissingRows.length} AST row(s) missing raw value`);
      }
      if (astNoInterpretation.length > 0) {
        reasonParts.push(`${astNoInterpretation.length} AST row(s) missing interpretation/no breakpoint`);
      }

      items.push(
        buildItem(accession, {
          queueCategory: "ast_pending",
          priority: "Moderate",
          reason: reasonParts.join("; ") || "AST pending.",
          nextAction: "Start or complete AST panel and ensure final interpretations are available.",
          status: "Pending AST completion",
          timestamp: accession.updatedAt,
          linkedSectionTarget: "ast",
        }),
      );
    }

    if (validation.blockers.length > 0) {
      items.push(
        buildItem(accession, {
          queueCategory: "release_blocked",
          priority: "High",
          reason: `${validation.blockers.length} validation blocker(s) prevent release.`,
          nextAction: "Resolve blocking validation issues.",
          status: "Blocked",
          timestamp: accession.updatedAt,
          linkedSectionTarget: "validation",
        }),
      );
    }

    const restrictedRows = accession.ast.filter((row) => isRestrictedRow(row));
    const amsRows = restrictedRows
      .map((row) => {
        const status = approvalStatusForRow(accession, row.id);
        const latest = latestApprovalForRow(accession, row.id);
        const overdue =
          status === "pending" && !!latest?.dueBy && new Date(latest.dueBy).getTime() < Date.now();
        return { row, status, latest, overdue };
      })
      .filter((x) => x.status !== "approved");

    if (amsRows.length > 0) {
      const hasOverdue = amsRows.some((x) => x.overdue);
      const statuses = [...new Set(amsRows.map((x) => (x.overdue ? "overdue" : x.status)))].join(", ");

      items.push(
        buildItem(accession, {
          queueCategory: "ams_approval",
          priority: hasOverdue ? "High" : "Moderate",
          reason: `${amsRows.length} restricted AST row(s) require AMS status (${statuses}).`,
          nextAction: "Request/resolve AMS approval for restricted agents.",
          status: hasOverdue ? "Overdue AMS" : "AMS pending",
          timestamp: amsRows
            .map((x) => x.latest?.requested?.at)
            .filter((x): x is string => Boolean(x))
            .sort()
            .at(-1) ?? accession.updatedAt,
          linkedSectionTarget: "ams",
        }),
      );
    }

    const ipc = evaluateIPC(accession, accessions);
    if (ipc.decisions.length > 0) {
      const immediate = ipc.decisions.some((d) => d.timing === "immediate");
      const sameShift = ipc.decisions.some((d) => d.timing === "same_shift");
      items.push(
        buildItem(accession, {
          queueCategory: "ipc_signal",
          priority: immediate ? "Critical" : sameShift ? "High" : "Moderate",
          reason: `${ipc.decisions.length} IPC signal(s) triggered (${ipc.decisions.map((d) => d.ruleCode).join(", ")}).`,
          nextAction: "Review IPC decision detail and execute required controls.",
          status: immediate ? "Immediate IPC" : sameShift ? "Same-shift IPC" : "IPC review",
          timestamp: ipc.signals.map((s) => s.raisedAt).sort().at(-1) ?? accession.updatedAt,
          linkedSectionTarget: "ipc",
        }),
      );
    }

    const unackPhoneOuts = accession.phoneOuts.filter((p) => !p.acknowledged);
    if (validation.phoneOutRequiredPending || unackPhoneOuts.length > 0) {
      items.push(
        buildItem(accession, {
          queueCategory: "critical_communication",
          priority: "High",
          reason: validation.phoneOutRequiredPending
            ? "Phone-out required by existing validation and not acknowledged."
            : `${unackPhoneOuts.length} unacknowledged phone-out event(s).`,
          nextAction: "Complete and acknowledge critical communication workflow.",
          status: "Communication incomplete",
          timestamp: unackPhoneOuts.map((p) => p.at).sort().at(-1) ?? accession.updatedAt,
          linkedSectionTarget: "release",
        }),
      );
    }

    if (!isReleasedState(accession) && validation.blockers.length === 0 && hasMeaningfulCaseData(accession)) {
      items.push(
        buildItem(accession, {
          queueCategory: "ready_for_review",
          priority: "Moderate",
          reason: "No blocking validation issues and case has reportable data.",
          nextAction: "Perform final review and proceed to release when appropriate.",
          status: "Ready",
          timestamp: accession.updatedAt,
          linkedSectionTarget: "validation",
        }),
      );
    }

    if (isReleasedState(accession)) {
      items.push(
        buildItem(accession, {
          queueCategory: "recently_released",
          priority: "Routine",
          reason:
            accession.release.state === ReleaseState.Amended
              ? "Case has a released amended report."
              : "Case has been released.",
          nextAction:
            accession.release.state === ReleaseState.Amended
              ? "Review amendment history for post-release actions."
              : "No immediate action required unless follow-up needed.",
          status: accession.release.state === ReleaseState.Amended ? "Amended" : "Released",
          timestamp: accession.release.releasedAt ?? accession.releasedAt ?? accession.updatedAt,
          linkedSectionTarget: "release",
        }),
      );
    }
  }

  const sorted = [...items].sort(compareItems);
  return { items: sorted, byCategory: bucket(sorted) };
}
