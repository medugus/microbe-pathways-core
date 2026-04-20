// "All Roles" popover — surfaces every role the build knows about, marks
// which are assigned to the signed-in user, which are active in the current
// (demo) view, and which are still planned/unimplemented.
//
// Includes a browser-phase demo role switcher. The switcher is UI-only and
// does not alter clinical data, RLS, or release rules.

import { useState } from "react";
import { useAuth } from "./AuthContext";
import { ROLE_CATALOG, getCatalogEntryByDbRole } from "./rolesCatalog";
import { useDemoRoleView } from "./demoRoleView";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function AllRolesPopover() {
  const { roles } = useAuth();
  const { activeView, setActiveView } = useDemoRoleView();
  const [open, setOpen] = useState(false);

  // Codes assigned to this user (mapped from DB enum -> catalog code).
  const assignedCodes = new Set(
    roles.map((r) => getCatalogEntryByDbRole(r)?.code).filter(Boolean) as string[],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
          All roles
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[420px] p-0">
        <div className="border-b border-border px-3 py-2">
          <div className="text-xs font-semibold text-foreground">Role inspector</div>
          <div className="text-[11px] text-muted-foreground">
            Shows every role the UI knows about. Assignment and authority remain
            server-enforced via RLS.
          </div>
        </div>

        <ul className="max-h-[60vh] overflow-y-auto divide-y divide-border">
          {ROLE_CATALOG.map((entry) => {
            const assigned = assignedCodes.has(entry.code);
            const isActiveView =
              activeView === entry.code || (activeView === null && assigned);
            return (
              <li key={entry.code} className="px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-foreground">
                        {entry.code}
                      </span>
                      <span className="text-xs font-medium text-foreground">
                        {entry.displayName}
                      </span>
                      {entry.status === "planned" && (
                        <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-300">
                          planned
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {entry.description}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                      <span
                        className={`rounded px-1.5 py-0.5 ${
                          assigned
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {assigned ? "assigned to you" : "not assigned"}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 ${
                          isActiveView
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isActiveView ? "active in session" : "inactive"}
                      </span>
                      {entry.dbRole && (
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground">
                          db: {entry.dbRole}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={activeView === entry.code ? "default" : "outline"}
                    disabled={entry.status === "planned"}
                    onClick={() =>
                      setActiveView(activeView === entry.code ? null : entry.code)
                    }
                    className="h-6 shrink-0 px-2 text-[11px]"
                    title={
                      entry.status === "planned"
                        ? "Planned role — not yet implemented in this build."
                        : "Preview the UI as this role (demo only)."
                    }
                  >
                    {activeView === entry.code ? "Previewing" : "Preview"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="border-t border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
          <div>
            <span className="font-medium text-foreground">Demo switcher:</span>{" "}
            UI-only. Does not change DB roles, RLS, or release/AMS/IPC rules.
          </div>
          {activeView && (
            <button
              type="button"
              onClick={() => setActiveView(null)}
              className="mt-1 rounded border border-border bg-background px-2 py-0.5 text-[11px] hover:bg-muted"
            >
              Reset to assigned roles
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
