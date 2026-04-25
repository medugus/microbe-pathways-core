import type { AMSApprovalStatus } from "../../domain/types";

const STATUS_TONE: Record<AMSApprovalStatus, string> = {
  not_requested: "chip chip-square chip-neutral",
  pending: "chip chip-square chip-ams-pending",
  approved: "chip chip-square chip-ams-approved",
  denied: "chip chip-square chip-ams-denied",
  expired: "chip chip-square chip-danger",
};

const STATUS_LABEL: Record<AMSApprovalStatus, string> = {
  not_requested: "Not requested",
  pending: "Pending",
  approved: "Approved",
  denied: "Denied",
  expired: "Expired",
};

export function AMSStatusChip({ status, overdue }: { status: AMSApprovalStatus; overdue?: boolean }) {
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${STATUS_TONE[status]}`}>
      {STATUS_LABEL[status]}
      {overdue ? " · OVERDUE" : ""}
    </span>
  );
}
