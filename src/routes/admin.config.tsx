// Admin · Config promotion (Stage 7, browser-phase only).
//
// Scope boundaries (DO NOT mistake this for production governance):
//   - localStorage persistence only; no backend config service
//   - single-editor model; no multi-user merge or conflict resolution
//   - actor identity is a free-text placeholder
//   - promote / rollback are recorded locally and never signed
//   - the active config version IS pinned into release packages and shown in
//     the app footer so reviewers can correlate releases with configs
//
// All lifecycle/diff math lives in src/medugu/logic/configEngine.ts. This file
// is a thin React shell over that engine + the configStore.

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/auth/RequireAuth";
import { SessionBar } from "@/auth/SessionBar";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CONFIG_SECTIONS,
  type ConfigSection,
  type ConfigSetPayload,
  diffPayloads,
  diffSectionRows,
  hasDraftChanges,
} from "@/medugu/logic/configEngine";
import { configStore, useConfigState } from "@/medugu/store/configStore";

export const Route = createFileRoute("/admin/config")({
  head: () => ({
    meta: [
      { title: "Admin · Config promotion — Medugu" },
      {
        name: "description",
        content:
          "Browser-phase config lifecycle: edit draft, promote, rollback, view history and diffs.",
      },
    ],
  }),
  component: AdminConfigPage,
});

function AdminConfigPage() {
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
  return <AdminConfigInner />;
}

function AdminConfigInner() {
  const config = useConfigState();
  const [activeSection, setActiveSection] = useState<ConfigSection>("organisms");
  const [showHistory, setShowHistory] = useState(false);
  const [diffTarget, setDiffTarget] = useState<number | null>(null);

  const draftDiff = useMemo(
    () =>
      diffPayloads(config.active.payload, config.draft, config.active.meta.version, "draft"),
    [config.active, config.draft],
  );
  const dirty = hasDraftChanges(config);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Link to="/" className="text-xs text-muted-foreground hover:underline">
              ← Workspace
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Config promotion</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage the organism, antibiotic, breakpoint, stewardship, and IPC rule sets that
            drive the engines. Active version pins propagate into every release package.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="font-mono">
              ACTIVE · v{config.active.meta.version}
            </Badge>
            {dirty && (
              <Badge variant="secondary" className="font-mono">
                DRAFT · {draftDiff.totalChanges} change
                {draftDiff.totalChanges === 1 ? "" : "s"}
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Browser-phase only · localStorage · no backend config service yet
          </p>
        </div>
      </header>

      <div className="callout callout-warning text-xs">
        <strong>Browser-phase scope:</strong> changes persist locally in this browser only.
        There is no multi-user editing, no server-side approval workflow, and no enterprise
        change-control. The same engine contract will later back onto a server-owned config
        service without changing this UI.
      </div>

      <ActiveSummaryCard />

      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <SectionNav active={activeSection} onChange={setActiveSection} />
        <SectionEditor section={activeSection} />
      </div>

      <PromoteCard />

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setShowHistory((v) => !v)}>
          {showHistory ? "Hide history" : `Show history (${config.history.length})`}
        </Button>
      </div>

      {showHistory && (
        <HistoryList
          onSelectDiff={(v) => setDiffTarget((cur) => (cur === v ? null : v))}
          diffTarget={diffTarget}
        />
      )}
    </div>
  );
}

// ---------- Active summary ----------

function ActiveSummaryCard() {
  const config = useConfigState();
  const a = config.active;
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <h2 className="mb-2 text-sm font-semibold">Active config set</h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Version</dt>
          <dd className="font-mono">v{a.meta.version}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Promoted</dt>
          <dd className="font-mono">{new Date(a.meta.at).toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Actor</dt>
          <dd>{a.meta.actor}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Kind</dt>
          <dd className="font-mono">{a.meta.kind}</dd>
        </div>
        <div className="col-span-full">
          <dt className="text-muted-foreground">Note</dt>
          <dd className="text-foreground">{a.meta.note}</dd>
        </div>
      </dl>
    </div>
  );
}

// ---------- Section nav ----------

function SectionNav({
  active,
  onChange,
}: {
  active: ConfigSection;
  onChange: (s: ConfigSection) => void;
}) {
  const config = useConfigState();
  return (
    <nav className="space-y-1">
      {CONFIG_SECTIONS.map((s) => {
        const isActive = active === s.key;
        const count = (config.draft[s.key] as unknown[]).length;
        const sectionDiff = diffPayloads(
          config.active.payload,
          config.draft,
          config.active.meta.version,
          "draft",
        ).sections.find((x) => x.section === s.key);
        const changes =
          (sectionDiff?.added ?? 0) + (sectionDiff?.removed ?? 0) + (sectionDiff?.changed ?? 0);
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onChange(s.key)}
            className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground hover:bg-muted/80"
            }`}
          >
            <span>{s.label}</span>
            <span className="flex items-center gap-1.5 font-mono text-[10px] opacity-80">
              {count}
              {changes > 0 && (
                <span
                  className={`rounded-sm px-1 ${
                    isActive ? "bg-primary-foreground/20" : "chip chip-square chip-warning"
                  }`}
                >
                  Δ{changes}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

// ---------- Section editor (JSON-based, browser-phase) ----------

function SectionEditor({ section }: { section: ConfigSection }) {
  const config = useConfigState();
  const draftJson = useMemo(
    () => JSON.stringify(config.draft[section], null, 2),
    [config.draft, section],
  );
  const [text, setText] = useState(draftJson);
  const [error, setError] = useState<string | null>(null);

  // Reset editor when active section changes or external draft changes.
  useEffect(() => {
    setText(draftJson);
    setError(null);
  }, [draftJson]);

  const sectionLabel = CONFIG_SECTIONS.find((s) => s.key === section)?.label ?? section;
  const rowDiff = useMemo(
    () =>
      diffSectionRows(
        section,
        config.active.payload[section] as unknown[],
        config.draft[section] as unknown[],
      ),
    [config.active, config.draft, section],
  );

  function applyEdit() {
    try {
      const parsed = JSON.parse(text) as ConfigSetPayload[ConfigSection];
      if (!Array.isArray(parsed)) {
        throw new Error("Section payload must be a JSON array.");
      }
      configStore.updateDraftSection(section, parsed as never);
      setError(null);
      toast.success(`${sectionLabel} draft updated`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">{sectionLabel}</h3>
          <p className="text-xs text-muted-foreground">
            Edit the draft JSON below, then apply. Promotion gates the change into the active
            set.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { setText(draftJson); setError(null); }}>
            Revert editor
          </Button>
          <Button size="sm" onClick={applyEdit}>
            Apply to draft
          </Button>
        </div>
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        className="min-h-[300px] font-mono text-xs"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}

      {rowDiff.length > 0 && (
        <div className="rounded-md border border-border bg-muted/40 p-3">
          <h4 className="mb-2 text-xs font-semibold">
            Draft vs active ({rowDiff.length} row{rowDiff.length === 1 ? "" : "s"} affected)
          </h4>
          <ul className="space-y-1 text-[11px]">
            {rowDiff.slice(0, 25).map((r) => (
              <li key={`${r.status}-${r.key}`} className="flex gap-2 font-mono">
                <span
                  className={
                    r.status === "added"
                      ? "text-success"
                      : r.status === "removed"
                        ? "text-destructive"
                        : "text-warning"
                  }
                >
                  {r.status === "added" ? "+" : r.status === "removed" ? "−" : "~"}
                </span>
                <span>{r.key}</span>
              </li>
            ))}
            {rowDiff.length > 25 && (
              <li className="text-muted-foreground">… +{rowDiff.length - 25} more</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------- Promote ----------

function PromoteCard() {
  const config = useConfigState();
  const [actor, setActor] = useState("");
  const [note, setNote] = useState("");
  const dirty = hasDraftChanges(config);

  function onPromote() {
    if (!note.trim()) {
      toast.error("Promotion note is required.");
      return;
    }
    try {
      configStore.promote({ actor: actor.trim() || "local", note: note.trim() });
      setNote("");
      toast.success(`Promoted to v${config.active.meta.version + 1}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Promotion failed");
    }
  }

  function onResetDraft() {
    if (!confirm("Discard all unsaved draft changes?")) return;
    configStore.resetDraft();
    toast.success("Draft reset to active");
  }

  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Promote draft → new active version</h2>
        {dirty ? (
          <Badge variant="secondary">draft has changes</Badge>
        ) : (
          <Badge variant="outline">draft = active</Badge>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="config-actor" className="text-xs">
            Actor (placeholder)
          </Label>
          <Input
            id="config-actor"
            placeholder="e.g. Dr. Smith"
            value={actor}
            onChange={(e) => setActor(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="config-note" className="text-xs">
            Promotion note (required)
          </Label>
          <Input
            id="config-note"
            placeholder="What changed and why?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button onClick={onPromote} disabled={!dirty}>
          Promote draft
        </Button>
        <Button variant="outline" onClick={onResetDraft} disabled={!dirty}>
          Discard draft
        </Button>
      </div>
      {!dirty && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          No draft changes to promote. Edit a section above first.
        </p>
      )}
    </div>
  );
}

// ---------- History + rollback ----------

function HistoryList({
  diffTarget,
  onSelectDiff,
}: {
  diffTarget: number | null;
  onSelectDiff: (v: number) => void;
}) {
  const config = useConfigState();
  if (config.history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No prior versions yet. Promote a draft to start building history.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Version history</h2>
      <ul className="space-y-2">
        {config.history.map((h) => {
          const expanded = diffTarget === h.meta.version;
          const d = diffPayloads(
            h.payload,
            config.active.payload,
            h.meta.version,
            config.active.meta.version,
          );
          return (
            <li key={h.meta.version} className="rounded-md border border-border bg-card p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <span className="font-mono">v{h.meta.version}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {h.meta.kind}
                      {h.meta.rolledBackTo ? ` → v${h.meta.rolledBackTo}` : ""}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(h.meta.at).toLocaleString()} · {h.meta.actor}
                  </p>
                  <p className="text-xs">{h.meta.note}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSelectDiff(h.meta.version)}
                  >
                    {expanded ? "Hide diff" : `Diff vs active (${d.totalChanges})`}
                  </Button>
                  <RollbackButton toVersion={h.meta.version} />
                </div>
              </div>
              {expanded && <DiffSummary diff={d} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DiffSummary({ diff }: { diff: ReturnType<typeof diffPayloads> }) {
  return (
    <div className="mt-3 rounded-md border border-border bg-muted/40 p-3">
      <p className="mb-2 text-[11px] text-muted-foreground">
        v{diff.fromVersion} → v{diff.toVersion} · {diff.totalChanges} total change
        {diff.totalChanges === 1 ? "" : "s"}
      </p>
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="py-1">Section</th>
            <th className="py-1 text-right">Added</th>
            <th className="py-1 text-right">Removed</th>
            <th className="py-1 text-right">Changed</th>
            <th className="py-1 text-right">Unchanged</th>
          </tr>
        </thead>
        <tbody>
          {diff.sections.map((s) => (
            <tr key={s.section} className="border-t border-border/40">
              <td className="py-1 font-mono">{s.section}</td>
              <td className="py-1 text-right text-success">
                {s.added || ""}
              </td>
              <td className="py-1 text-right text-destructive">{s.removed || ""}</td>
              <td className="py-1 text-right text-warning">
                {s.changed || ""}
              </td>
              <td className="py-1 text-right text-muted-foreground">{s.unchanged}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RollbackButton({ toVersion }: { toVersion: number }) {
  const [open, setOpen] = useState(false);
  const [actor, setActor] = useState("");
  const [note, setNote] = useState("");

  function onConfirm() {
    if (!note.trim()) {
      toast.error("Rollback note is required.");
      return;
    }
    try {
      configStore.rollback({ toVersion, actor: actor.trim() || "local", note: note.trim() });
      toast.success(`Rolled back to v${toVersion}`);
      setOpen(false);
      setNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rollback failed");
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Rollback to v{toVersion}
      </Button>
    );
  }
  return (
    <div className="w-full space-y-2 callout callout-warning">
      <p className="text-xs">
        Restore <strong>v{toVersion}</strong> as a new active version. The current active
        version stays in history; nothing is destroyed.
      </p>
      <Input
        placeholder="Actor (placeholder)"
        value={actor}
        onChange={(e) => setActor(e.target.value)}
      />
      <Input
        placeholder="Why rolling back? (required)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={onConfirm}>
          Confirm rollback
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
