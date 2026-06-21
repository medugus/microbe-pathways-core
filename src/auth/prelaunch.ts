export const PRELAUNCH_TENANT_ID = "prelaunch-local-tenant";
export const PRELAUNCH_USER_ID = "prelaunch-local-admin";

export function isPrelaunchNoAuthEnabled() {
  return import.meta.env.VITE_MEDUGU_REQUIRE_AUTH !== "true";
}
