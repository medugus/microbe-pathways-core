// Collapsible workspace panel. Sections use this so the entire case
// is scannable on one continuous surface, while individual sections
// can be collapsed when not in focus.

import { useState, type ReactNode } from "react";

interface Props {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function SectionPanel({
  id,
  title,
  subtitle,
  badge,
  defaultOpen = true,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      id={id}
      className="overflow-hidden rounded-lg border border-border bg-card"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 border-b border-border px-4 py-3 text-left hover:bg-muted/40"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-foreground">{title}</h3>
            {badge && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>
      {open && <div className="p-4">{children}</div>}
    </section>
  );
}
