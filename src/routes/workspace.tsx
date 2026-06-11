// Continuous case workspace route (accession → release).
// Moved off "/" so the Hub can be the post-login landing page.
// All logic still lives in src/medugu/* — this file only wires the route.

import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/medugu/ui/AppShell";
import { RequireAuth } from "@/auth/RequireAuth";
import { SessionBar } from "@/auth/SessionBar";
import { CloudHydrationGate } from "@/medugu/store/CloudHydrationGate";

export const Route = createFileRoute("/workspace")({
  head: () => ({
    meta: [
      { title: "Case workspace — Medugu" },
      {
        name: "description",
        content:
          "Continuous case workspace: accession, specimen, microscopy, isolate, AST, stewardship, IPC, validation, release.",
      },
    ],
  }),
  component: WorkspaceRoute,
});

function WorkspaceRoute() {
  return (
    <RequireAuth>
      <CloudHydrationGate>
        <div className="min-h-screen bg-background">
          <SessionBar />
          <AppShell />
        </div>
      </CloudHydrationGate>
    </RequireAuth>
  );
}
