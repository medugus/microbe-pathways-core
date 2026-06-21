import type { ValidationIssue } from "../domain/types";

export interface WorkspaceNavigationTarget {
  sectionId: string;
  anchorId?: string;
  label: string;
}

const SECTION_LABELS: Record<string, string> = {
  patient: "Patient",
  specimen: "Specimen",
  microscopy: "Microscopy",
  isolate: "Isolate",
  ast: "AST",
  stewardship: "Stewardship",
  ams: "AMS",
  ipc: "IPC",
  outbreak: "Outbreak",
  validation: "Validation",
  release: "Release",
  report: "Report",
  export: "Export",
  operations: "Dashboard",
};

function sectionTarget(section: string): WorkspaceNavigationTarget {
  const normalized = section || "validation";
  return {
    sectionId: `sec-${normalized}`,
    label: SECTION_LABELS[normalized] ?? normalized,
  };
}

function isBloodBottleWorkupIssue(code: string): boolean {
  return (
    code === "BC_ISO_MISSING_FOR_POSITIVE" ||
    /^BC_ISO_\d+_SOURCE_MISSING$/.test(code) ||
    /^BC_BOTTLE_/.test(code)
  );
}

export function targetForValidationIssue(
  issue: Pick<ValidationIssue, "code" | "section">,
): WorkspaceNavigationTarget {
  if (isBloodBottleWorkupIssue(issue.code)) {
    return {
      sectionId: "sec-isolate",
      anchorId: "blood-culture-bottle-workup",
      label: "Blood bottle workup",
    };
  }

  if (issue.code === "BC_SETS_MISSING" || /^BC_SET_\d+_/.test(issue.code)) {
    return sectionTarget("specimen");
  }

  if (issue.code === "PHONE_OUT_REQUIRED" || issue.code === "CONSULTANT_APPROVAL_REQUIRED") {
    return sectionTarget("release");
  }

  if (issue.code === "AMS_PENDING_RESTRICTED") {
    return sectionTarget("ams");
  }

  if (issue.code.startsWith("IPC_")) {
    return sectionTarget("ipc");
  }

  if (issue.code.startsWith("COL_SCREEN_ISO_") && issue.code.includes("_ORGANISM_")) {
    return sectionTarget("isolate");
  }

  if (issue.code.startsWith("COL_SCREEN_") && issue.code.includes("_AST_")) {
    return sectionTarget("ast");
  }

  return sectionTarget(issue.section);
}

export function navigateToWorkspaceTarget(target: WorkspaceNavigationTarget) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  window.dispatchEvent(
    new CustomEvent("medugu:open-section", {
      detail: { id: target.sectionId },
    }),
  );

  window.setTimeout(() => {
    const element =
      document.getElementById(target.anchorId ?? target.sectionId) ??
      document.getElementById(target.sectionId);
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 80);
}

export function navigateToValidationIssue(issue: ValidationIssue) {
  navigateToWorkspaceTarget(targetForValidationIssue(issue));
}
