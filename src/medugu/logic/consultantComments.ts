import type { Accession } from "../domain/types";
import type { ReportPreviewDoc } from "./reportPreview";

export function buildConsultantMicrobiologistComments(doc: ReportPreviewDoc): string[] {
  const hasAst = doc.isolates.some((isolate) => isolate.ast.length > 0);
  const hasBloodCulture = Boolean(doc.bloodSets?.length || doc.bloodBottles?.length);
  const hasIpc = doc.ipc.length > 0 || doc.internalNotes.length > 0;

  const comments: string[] = [
    "Interpret results alongside the clinical syndrome, specimen quality, prior antimicrobial exposure and source control.",
  ];

  if (hasAst) {
    comments.push(
      `Antimicrobial susceptibility interpretation follows the stated breakpoint authority/version (${doc.versions.breakpoint}); apply local prescribing guidance and stewardship restrictions before treatment changes.`,
    );
  }

  if (hasBloodCulture) {
    comments.push(
      "For blood cultures, correlate organism significance with bottle pattern, time to positivity, line/peripheral source and repeat cultures; probable contaminants require clinical correlation.",
    );
  }

  if (hasIpc) {
    comments.push(
      "Alert organism or IPC signals should be actioned according to local infection prevention policy; urgent clinical or IPC queries should be escalated to microbiology.",
    );
  }

  comments.push(
    "Contact the consultant microbiologist for complex infection, sterile-site growth, multidrug resistance, treatment failure, or discordance between clinical picture and laboratory findings.",
  );

  return comments;
}

export function consultantSignOffLabel(accession: Accession): string {
  const approval = accession.release.consultantApproval;
  if (!approval) return "Consultant microbiologist: ______________________________";
  const at = new Date(approval.approvedAt);
  const when = Number.isNaN(at.getTime()) ? approval.approvedAt : at.toLocaleString();
  return `Consultant microbiologist: ${approval.approvedBy} (${when})`;
}
