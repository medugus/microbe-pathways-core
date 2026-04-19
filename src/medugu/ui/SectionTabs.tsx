import { SECTION_ORDER, type SectionKey } from "./sections";

interface Props {
  active: SectionKey;
  onChange: (key: SectionKey) => void;
}

export function SectionTabs({ active, onChange }: Props) {
  return (
    <nav className="flex flex-wrap gap-1 border-b border-border bg-card px-4 py-2">
      {SECTION_ORDER.map((s) => {
        const isActive = s.key === active;
        return (
          <button
            key={s.key}
            onClick={() => onChange(s.key)}
            className={
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors " +
              (isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground")
            }
          >
            {s.label}
          </button>
        );
      })}
    </nav>
  );
}
