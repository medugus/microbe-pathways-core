import type { IPCAction } from "../../../config/ipcRules";

interface IPCActionChecklistProps {
  actions: IPCAction[];
  acknowledgedAt?: string;
  acknowledgedBy?: string;
}

const ACTION_LABELS: Record<IPCAction, string> = {
  contact_precautions: "Contact precautions",
  contact_plus_precautions: "Contact-plus precautions",
  droplet_precautions: "Droplet precautions",
  airborne_precautions: "Airborne precautions",
  single_room: "Single room",
  cohort_room: "Cohort room",
  enhanced_environmental_cleaning: "Enhanced environmental cleaning",
  notify_ipc_team: "Notify IPC team",
  notify_attending: "Notify attending clinician",
  notify_public_health: "Notify public health",
  screen_contacts: "Screen contacts",
};

export function IPCActionChecklist({
  actions,
  acknowledgedAt,
  acknowledgedBy,
}: IPCActionChecklistProps) {
  const completionAvailable = Boolean(acknowledgedAt);

  return (
    <section className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
      <p className="text-xs font-medium text-foreground">Required actions</p>
      <p className="text-[10px] text-muted-foreground">
        Browser-phase checklist; persistent action completion requires backend/audit support.
      </p>
      <ul className="space-y-1 text-xs">
        {actions.map((action) => (
          <li
            key={action}
            className="flex flex-wrap items-center gap-2 rounded-sm border border-border/70 bg-background px-2 py-1.5"
          >
            <span className="font-medium text-foreground">
              {ACTION_LABELS[action] ?? action.replaceAll("_", " ")}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${completionAvailable ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}
            >
              {completionAvailable ? "completed" : "pending"}
            </span>
            {completionAvailable && acknowledgedBy && (
              <span className="text-[10px] text-muted-foreground">actor: {acknowledgedBy}</span>
            )}
            {completionAvailable && acknowledgedAt && (
              <span className="text-[10px] text-muted-foreground">
                at: {new Date(acknowledgedAt).toLocaleString()}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
