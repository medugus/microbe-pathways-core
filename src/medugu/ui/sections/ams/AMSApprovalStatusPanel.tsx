import type { AMSApprovalStatus } from "../../../domain/types";

const STATUS_TONE: Record<AMSApprovalStatus | "not_required", string> = {
  not_requested: "chip chip-square chip-neutral",
  pending: "chip chip-square chip-ams-pending",
  approved: "chip chip-square chip-ams-approved",
  denied: "chip chip-square chip-ams-denied",
  expired: "chip chip-square chip-danger",
  not_required: "chip chip-square chip-success",
};

const STATUS_LABEL: Record<AMSApprovalStatus | "not_required", string> = {
  not_requested: "Not requested",
  pending: "Requested",
  approved: "Approved",
  denied: "Denied",
  expired: "Expired",
  not_required: "Not required",
};

export function AMSApprovalStatusPanel({
  status,
  required,
}: {
  status: AMSApprovalStatus;
  required: boolean;
}) {
  const effective = required ? status : "not_required";
  return (
    <div className="rounded-md border border-border bg-background px-2 py-1.5 text-[11px]">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        Approval state
      </div>
      <span className={STATUS_TONE[effective]}>{STATUS_LABEL[effective]}</span>
      {required ? (
        <p className="mt-1 text-muted-foreground">
          Browser phase workflow; approval persistence is local to this session/store.
        </p>
      ) : (
        <p className="mt-1 text-muted-foreground">No AMS approval requirement for this item.</p>
      )}
    </div>
  );
}
