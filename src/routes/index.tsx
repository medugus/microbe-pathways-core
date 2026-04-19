import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/medugu/ui/AppShell";
import { RequireAuth } from "@/auth/RequireAuth";
import { SessionBar } from "@/auth/SessionBar";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Medugu Platform v3 — AMCE Microbiology" },
      {
        name: "description",
        content:
          "Clinical microbiology workflow platform: accession, specimen, AST, stewardship, IPC, validation, release.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-background">
        <SessionBar />
        <AppShell />
      </div>
    </RequireAuth>
  );
}
