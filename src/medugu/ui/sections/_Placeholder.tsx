import type { ReactNode } from "react";
import type { Accession } from "../../domain/types";

interface Props {
  title: string;
  accession: Accession | null;
  description: string;
  children?: ReactNode;
}

export function SectionPlaceholder({ title, accession, description, children }: Props) {
  if (!accession) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No active accession. Select or create one in the case manager.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </header>
      <div className="rounded-lg border border-dashed border-border bg-card p-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Phase scaffold — detailed rules pending
        </p>
        <pre className="mt-3 overflow-auto rounded-md bg-muted p-3 font-mono text-xs text-foreground">
{JSON.stringify(
  {
    accessionId: accession.id,
    stage: accession.stage,
    releaseState: accession.release.state,
  },
  null,
  2,
)}
        </pre>
        {children}
      </div>
    </div>
  );
}
