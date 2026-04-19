// Right-hand jump rail. Lets the operator scroll to any section in the
// continuous workspace without losing context of the others.

import { SECTION_ORDER } from "./sections";

export function SectionRail() {
  return (
    <nav
      aria-label="Workspace sections"
      className="hidden w-40 shrink-0 border-l border-border bg-card/50 p-3 lg:block"
    >
      <div className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        Jump to
      </div>
      <ul className="space-y-1">
        {SECTION_ORDER.map((s) => (
          <li key={s.key}>
            <a
              href={`#sec-${s.key}`}
              className="block rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
