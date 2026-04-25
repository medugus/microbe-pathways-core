// AMS browser-phase configuration and messaging.

/** Browser-phase SLA policy. Restricted agents get 24h; reserve agents 4h. */
export const AMS_POLICY = {
  defaultSlaHours: 24,
  reserveSlaHours: 4,
  /** Hours after dueBy at which a pending request is considered expired. */
  expiryGraceHours: 48,
} as const;

export const AMS_BROWSER_PHASE_WARNING =
  "Browser-phase AMS workflow — actor identity is a manual placeholder, no external notifications are delivered, and SLA / escalation values are informational only. Production auth/role enforcement is out of scope for this stage.";
