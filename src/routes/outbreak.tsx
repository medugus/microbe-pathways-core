// Standalone outbreak dashboard route.
// Kept outside the accession-to-release workspace so surveillance does not
// interrupt routine result entry/release flow.

import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/auth/RequireAuth";
import { SessionBar } from "@/auth/SessionBar";
import { CloudHydrationGate } from "@/medugu/store/CloudHydrationGate";
import { OutbreakSection } from "@/medugu/ui/sections/OutbreakSection";

export const Route = createFileRoute("/outbreak")({
  head: () => ({
    meta: [
      { title: "Outbreak dashboard - Medugu" },
      {
        name: "description",
        content:
          "Standalone outbreak surveillance dashboard for candidate isolate-pair review and IPC handoff.",
      },
    ],
  }),
  component: OutbreakRoute,
});

function OutbreakRoute() {
  return (
    <RequireAuth>
      <CloudHydrationGate>
        <div className="min-h-screen bg-background text-foreground">
          <SessionBar />
          <header className="border-b border-border bg-card px-6 py-4">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold">Outbreak dashboard</h1>
                <p className="text-xs text-muted-foreground">
                  Dedicated IPC surveillance view. Routine accession result entry stays in the
                  workspace.
                </p>
              </div>
              <nav className="flex flex-wrap items-center gap-2 text-xs">
                <Link
                  to="/workspace"
                  className="rounded border border-border px-3 py-1.5 hover:bg-muted"
                >
                  Back to workspace
                </Link>
                <Link to="/ipc" className="rounded border border-border px-3 py-1.5 hover:bg-muted">
                  IPC episodes
                </Link>
              </nav>
            </div>
          </header>

          <main className="mx-auto max-w-7xl p-6">
            <OutbreakSection />
          </main>
        </div>
      </CloudHydrationGate>
    </RequireAuth>
  );
}
