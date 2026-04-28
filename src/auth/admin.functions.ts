// Admin server functions for tenant user management.
// All operations require the caller to be an `admin` in the target tenant.
// Uses the auth middleware to identify the caller, then uses the service-role
// client for the privileged operations (inviting via auth.admin, granting roles).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const APP_ROLES = [
  "lab_tech",
  "microbiologist",
  "consultant",
  "ams_pharmacist",
  "ipc",
  "admin",
] as const;
type AppRole = (typeof APP_ROLES)[number];

async function assertAdmin(callerId: string, tenantId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .eq("tenant_id", tenantId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(`Role check failed: ${error.message}`);
  if (!data) throw new Error("Forbidden: not an admin in this tenant");
}

// ---------- list members ----------

export const listTenantMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) =>
    z.object({ tenantId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, data.tenantId);

    const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, display_name, email, created_at")
        .eq("tenant_id", data.tenantId),
      supabaseAdmin
        .from("user_roles")
        .select("user_id, role, granted_at")
        .eq("tenant_id", data.tenantId),
    ]);
    if (pErr) throw new Error(pErr.message);
    if (rErr) throw new Error(rErr.message);

    const rolesByUser = new Map<string, AppRole[]>();
    for (const r of roles ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role as AppRole);
      rolesByUser.set(r.user_id, arr);
    }
    return {
      members: (profiles ?? []).map((p) => ({
        id: p.id,
        displayName: p.display_name,
        email: p.email,
        createdAt: p.created_at,
        roles: rolesByUser.get(p.id) ?? [],
      })),
    };
  });

// ---------- invite ----------

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; email: string; roles: AppRole[] }) =>
    z
      .object({
        tenantId: z.string().uuid(),
        email: z.string().email().max(320),
        roles: z.array(z.enum(APP_ROLES)).min(1).max(APP_ROLES.length),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, data.tenantId);

    // Look up the tenant slug so the new user joins THIS tenant via the
    // handle_new_user trigger (it reads tenant_slug from raw_user_meta_data).
    const { data: tenant, error: tErr } = await supabaseAdmin
      .from("tenants")
      .select("slug, name")
      .eq("id", data.tenantId)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!tenant) throw new Error("Tenant not found");

    // Check if user already exists in auth (any tenant).
    const { data: existingList, error: lErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (lErr) throw new Error(lErr.message);
    const existing = existingList.users.find(
      (u) => (u.email ?? "").toLowerCase() === data.email.toLowerCase(),
    );

    let userId: string;
    let invited = false;
    if (existing) {
      userId = existing.id;
      // Confirm they belong to this tenant; if not, this is an error — we don't
      // currently support cross-tenant membership for the same auth user.
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("tenant_id")
        .eq("id", userId)
        .maybeSingle();
      if (prof && prof.tenant_id !== data.tenantId) {
        throw new Error(
          "This email already belongs to a different tenant. Cross-tenant membership is not supported.",
        );
      }
    } else {
      const { data: invite, error: iErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        data.email,
        {
          data: {
            tenant_slug: tenant.slug,
            tenant_name: tenant.name,
          },
        },
      );
      if (iErr) throw new Error(iErr.message);
      if (!invite.user) throw new Error("Invite returned no user");
      userId = invite.user.id;
      invited = true;
    }

    // Grant requested roles (idempotent).
    const rows = data.roles.map((role) => ({
      user_id: userId,
      tenant_id: data.tenantId,
      role,
      granted_by: context.userId,
    }));
    const { error: gErr } = await supabaseAdmin
      .from("user_roles")
      .upsert(rows, { onConflict: "user_id,tenant_id,role", ignoreDuplicates: true });
    if (gErr) throw new Error(gErr.message);

    // Audit
    await supabaseAdmin.from("audit_event").insert({
      tenant_id: data.tenantId,
      actor_user_id: context.userId,
      action: invited ? "user.invited" : "user.rolesAdded",
      entity: "accession", // entity column is text; use a known value
      entity_id: userId,
      field: "user_roles",
      new_value: { email: data.email, roles: data.roles, invited } as never,
    } as never);

    return { userId, invited, roles: data.roles };
  });

// ---------- grant role ----------

export const grantRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; userId: string; role: AppRole }) =>
    z
      .object({
        tenantId: z.string().uuid(),
        userId: z.string().uuid(),
        role: z.enum(APP_ROLES),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, data.tenantId);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        [
          {
            user_id: data.userId,
            tenant_id: data.tenantId,
            role: data.role,
            granted_by: context.userId,
          },
        ],
        { onConflict: "user_id,tenant_id,role", ignoreDuplicates: true },
      );
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_event").insert({
      tenant_id: data.tenantId,
      actor_user_id: context.userId,
      action: "user.roleGranted",
      entity: "accession",
      entity_id: data.userId,
      field: "user_roles",
      new_value: { role: data.role } as never,
    } as never);
    return { ok: true };
  });

// ---------- revoke role ----------

export const revokeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; userId: string; role: AppRole }) =>
    z
      .object({
        tenantId: z.string().uuid(),
        userId: z.string().uuid(),
        role: z.enum(APP_ROLES),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, data.tenantId);

    // Guard: prevent removing the last admin in the tenant.
    if (data.role === "admin") {
      const { data: admins, error: aErr } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("tenant_id", data.tenantId)
        .eq("role", "admin");
      if (aErr) throw new Error(aErr.message);
      if ((admins ?? []).length <= 1) {
        throw new Error("Cannot revoke the last admin in this tenant.");
      }
    }

    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("tenant_id", data.tenantId)
      .eq("role", data.role);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_event").insert({
      tenant_id: data.tenantId,
      actor_user_id: context.userId,
      action: "user.roleRevoked",
      entity: "accession",
      entity_id: data.userId,
      field: "user_roles",
      old_value: { role: data.role } as never,
    } as never);
    return { ok: true };
  });
