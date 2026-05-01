// CommandPalette — ⌘K / Ctrl+K fuzzy launcher.
//
// Three command groups:
//   1. Accessions — switch active case (matches accession #, MRN, name).
//   2. Sections    — scroll to a workspace section in the current case.
//   3. Navigate    — jump to a top-level route (Operations, AMS, IPC, etc.).
//
// Pure UX. No AI, no audit. The palette reads from existing stores and
// dispatches existing actions; it never mutates clinical state.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useMeduguState, meduguActions } from "../store/useAccessionStore";
import { SECTION_ORDER } from "./sections";
import { FileText, LayoutGrid, Compass } from "lucide-react";

const ROUTES: Array<{ to: string; label: string; hint: string }> = [
  { to: "/", label: "Workspace", hint: "Cases" },
  { to: "/ams", label: "AMS approvals", hint: "Stewardship" },
  { to: "/ipc", label: "IPC signals", hint: "Infection control" },
  { to: "/analytics", label: "Analytics", hint: "Trends" },
  { to: "/audit", label: "Audit log", hint: "Trail" },
  { to: "/admin/users", label: "Users", hint: "Admin" },
  { to: "/admin/receivers", label: "Receivers", hint: "Admin" },
  { to: "/admin/config", label: "Config", hint: "Admin" },
  { to: "/settings/sounds", label: "Sound preferences", hint: "Settings" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const state = useMeduguState();

  // Global hotkey: ⌘K / Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const accessions = useMemo(
    () =>
      state.accessionOrder
        .map((id) => state.accessions[id])
        .filter(Boolean)
        .slice(0, 50),
    [state.accessionOrder, state.accessions],
  );

  const close = useCallback(() => setOpen(false), []);

  function pickAccession(id: string) {
    meduguActions.setActive(id);
    close();
    // Wait one tick so the workspace re-renders before we try to scroll.
    setTimeout(() => {
      const el = document.getElementById("sec-patient");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function pickSection(key: string) {
    close();
    setTimeout(() => {
      const el = document.getElementById(`sec-${key}`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function pickRoute(to: string) {
    close();
    void navigate({ to });
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search cases, sections, pages…  (⌘K)" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>

        {accessions.length > 0 && (
          <>
            <CommandGroup heading="Cases">
              {accessions.map((a) => {
                const name = `${a.patient.givenName} ${a.patient.familyName}`.trim();
                const subtitle = `${a.accessionNumber} · MRN ${a.patient.mrn}`;
                // Build a value string that cmdk's fuzzy matcher can search across.
                const value = `${a.accessionNumber} ${a.patient.mrn} ${name} ${a.specimen.subtypeCode ?? ""} ${a.specimen.freeTextLabel ?? ""}`;
                return (
                  <CommandItem
                    key={a.id}
                    value={value}
                    onSelect={() => pickAccession(a.id)}
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-1 items-baseline justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm text-foreground">{name || "Unnamed patient"}</div>
                        <div className="truncate text-[11px] text-muted-foreground">{subtitle}</div>
                      </div>
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                        {a.workflowStatus}
                      </span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Sections (current case)">
          {SECTION_ORDER.map((s) => (
            <CommandItem
              key={s.key}
              value={`section ${s.label} ${s.key}`}
              onSelect={() => pickSection(s.key)}
            >
              <LayoutGrid className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{s.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigate">
          {ROUTES.map((r) => (
            <CommandItem
              key={r.to}
              value={`navigate ${r.label} ${r.hint} ${r.to}`}
              onSelect={() => pickRoute(r.to)}
            >
              <Compass className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-1 items-baseline justify-between gap-3">
                <span className="text-sm">{r.label}</span>
                <span className="text-[10px] uppercase text-muted-foreground">{r.hint}</span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
