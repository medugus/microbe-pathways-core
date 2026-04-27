// Admin-only tenant user management.
// Tenant admins can invite users by email, see all members, and grant/revoke roles.
// Calls server functions that re-verify admin status with the service-role client.

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/auth/RequireAuth";
import { SessionBar } from "@/auth/SessionBar";
import { useAuth, type AppRole } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { grantRole, inviteUser, listTenantMembers, revokeRole } from "@/auth/admin.functions";

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { title: "Admin · Users — Medugu" },
      { name: "description", content: "Tenant user and role administration." },
    ],
  }),
  component: AdminUsersPage,
});

const ALL_ROLES: AppRole[] = [
  "lab_tech",
  "microbiologist",
  "consultant",
  "ams_pharmacist",
  "ipc",
  "admin",
];

interface Member {
  id: string;
  displayName: string | null;
  email: string | null;
  createdAt: string;
  roles: AppRole[];
}

function AdminUsersPage() {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-background">
        <SessionBar />
        <AdminGate />
      </div>
    </RequireAuth>
  );
}

function AdminGate() {
  const { hasRole, loading, tenantId } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    if (!hasRole("admin")) {
      toast.error("Admin role required");
      void navigate({ to: "/", replace: true });
    }
  }, [loading, hasRole, navigate]);
  if (loading || !tenantId || !hasRole("admin")) {
    return <div className="p-6 text-sm text-muted-foreground">Checking permissions…</div>;
  }
  return <AdminUsersInner tenantId={tenantId} />;
}

function AdminUsersInner({ tenantId }: { tenantId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  // Invite form
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("lab_tech");

  const reload = async () => {
    setLoading(true);
    try {
      const res = await listTenantMembers({ data: { tenantId } });
      setMembers(res.members);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load members");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy("invite");
    try {
      const res = await inviteUser({
        data: { tenantId, email: email.trim(), roles: [inviteRole] },
      });
      toast.success(
        res.invited
          ? `Invitation email sent to ${email}`
          : `Granted ${inviteRole} to existing member ${email}`,
      );
      setEmail("");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invite failed");
    } finally {
      setBusy(null);
    }
  };

  const handleGrant = async (userId: string, role: AppRole) => {
    setBusy(`${userId}:${role}:grant`);
    try {
      await grantRole({ data: { tenantId, userId, role } });
      toast.success(`Granted ${role}`);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Grant failed");
    } finally {
      setBusy(null);
    }
  };

  const handleRevoke = async (userId: string, role: AppRole) => {
    setBusy(`${userId}:${role}:revoke`);
    try {
      await revokeRole({ data: { tenantId, userId, role } });
      toast.success(`Revoked ${role}`);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Revoke failed");
    } finally {
      setBusy(null);
    }
  };

  const sorted = useMemo(
    () =>
      [...members].sort((a, b) =>
        (a.displayName ?? a.email ?? "").localeCompare(b.displayName ?? b.email ?? ""),
      ),
    [members],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tenant users</h1>
          <p className="text-xs text-muted-foreground">
            Invite members and manage roles within your lab.
          </p>
        </div>
        <Link to="/" className="text-sm text-primary underline-offset-4 hover:underline">
          ← Back to lab
        </Link>
      </div>

      {/* Invite form */}
      <form
        onSubmit={handleInvite}
        className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-muted/30 p-4"
      >
        <div className="grow space-y-1">
          <Label htmlFor="invite-email">Invite by email</Label>
          <Input
            id="invite-email"
            type="email"
            required
            placeholder="colleague@hospital.org"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="invite-role">Initial role</Label>
          <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
            <SelectTrigger id="invite-role" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALL_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={busy === "invite"}>
          {busy === "invite" ? "Sending…" : "Send invitation"}
        </Button>
      </form>

      {/* Member table */}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">User</th>
                <th className="p-3 font-medium">Email</th>
                <th className="p-3 font-medium">Roles</th>
                <th className="p-3 font-medium">Add role</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  busy={busy}
                  onGrant={handleGrant}
                  onRevoke={handleRevoke}
                />
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-muted-foreground">
                    No members yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MemberRow({
  member,
  busy,
  onGrant,
  onRevoke,
}: {
  member: Member;
  busy: string | null;
  onGrant: (userId: string, role: AppRole) => void;
  onRevoke: (userId: string, role: AppRole) => void;
}) {
  const available = ALL_ROLES.filter((r) => !member.roles.includes(r));
  const [pending, setPending] = useState<AppRole>(available[0] ?? "lab_tech");

  return (
    <tr className="border-t border-border align-top">
      <td className="p-3">{member.displayName ?? "—"}</td>
      <td className="p-3 text-muted-foreground">{member.email ?? "—"}</td>
      <td className="p-3">
        <div className="flex flex-wrap gap-1">
          {member.roles.length === 0 && (
            <span className="text-xs text-muted-foreground">No roles</span>
          )}
          {member.roles.map((r) => (
            <span
              key={r}
              className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs text-primary"
            >
              {r}
              <button
                type="button"
                disabled={busy === `${member.id}:${r}:revoke`}
                onClick={() => onRevoke(member.id, r)}
                className="text-primary/70 hover:text-destructive disabled:opacity-40"
                aria-label={`Revoke ${r}`}
                title={`Revoke ${r}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </td>
      <td className="p-3">
        {available.length === 0 ? (
          <span className="text-xs text-muted-foreground">All roles granted</span>
        ) : (
          <div className="flex items-center gap-2">
            <Select value={pending} onValueChange={(v) => setPending(v as AppRole)}>
              <SelectTrigger className="h-8 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {available.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy === `${member.id}:${pending}:grant`}
              onClick={() => onGrant(member.id, pending)}
            >
              Grant
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}
