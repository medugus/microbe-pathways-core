import { useActiveAccession } from "../../store/useAccessionStore";
import { SectionPlaceholder } from "./_Placeholder";

export function ASTSection() {
  const accession = useActiveAccession();
  return (
    <SectionPlaceholder
      title="AST"
      description="MIC / disk diffusion entry, breakpoint resolution, expert rules. Engine lives in logic/astEngine."
      accession={accession}
    >
      {accession && (
        <p className="mt-3 text-sm text-muted-foreground">
          {accession.ast.length} AST result(s).
        </p>
      )}
    </SectionPlaceholder>
  );
}
