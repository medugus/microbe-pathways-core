// Resolves the current AMS approver identity + authority from the auth context.
//
// Browser-phase replaced an editable text input with this hook so the actor
// captured on every AMS request/decision is the signed-in user's display
// name + role, never a free-text placeholder. The audit row also includes
// auth.uid() (via cloudAudit) so the trail is forensically attributable.

import { useMemo } from "react";
import { useAuth, type AppRole } from "@/auth/AuthContext";

const APPROVER_ROLES: AppRole[] = ["ams_pharmacist", "consultant", "admin"];
const REQUESTER_ROLES: AppRole[] = [
  "lab_tech",
  "microbiologist",
  "consultant",
  "ams_pharmacist",
  "admin",
];

export interface AMSActor {
  /** Display label used in audit + UI. Falls back to email or "unknown". */
  label: string;
  /** Auth user id (forensic attribution). */
  userId: string | null;
  /** Role granted in the active tenant that authorises the action. */
  role: AppRole | null;
  /** True when user may approve / deny restricted-drug requests. */
  canApprove: boolean;
  /** True when user may file a new approval request. */
  canRequest: boolean;
}

export function useAMSActor(): AMSActor {
  const { user, profile, roles } = useAuth();
  return useMemo(() => {
    const approverRole = APPROVER_ROLES.find((r) => roles.includes(r)) ?? null;
    const requesterRole = REQUESTER_ROLES.find((r) => roles.includes(r)) ?? null;
    return {
      label:
        profile?.display_name?.trim() ||
        profile?.email?.trim() ||
        user?.email ||
        "unknown",
      userId: user?.id ?? null,
      role: approverRole ?? requesterRole,
      canApprove: Boolean(approverRole),
      canRequest: Boolean(requesterRole),
    };
  }, [user, profile, roles]);
}
