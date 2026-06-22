// Right-hand jump rail. Lets the operator scroll to any section in the
// continuous workspace without losing context of the others.

import { SECTION_ORDER } from "./sections";
import type { SectionKey } from "./sections";

interface SectionRailProps {
  sections?: readonly { key: SectionKey; label: string }[];
}

export function SectionRail({ sections = SECTION_ORDER }: SectionRailProps) {
  return (
    <nav
      aria-label="Workspace sections"
      className="hidden w-40 overflow-y-auto border-l border-border bg-card/95 p-3 shadow-sm backdrop-blur lg:fixed lg:bottom-10 lg:right-0 lg:top-28 lg:z-30 lg:block"
    >
      <div className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">Jump to</div>
      <ul className="space-y-1">
        {sections.map((s) => (
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
