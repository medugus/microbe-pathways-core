import { ANTIBIOTICS } from "../../config/antibiotics";
import { PRIMARY_STANDARD, SECONDARY_STANDARD } from "../../config/breakpoints";
import { ASTMethod } from "../../domain/enums";
import type { ASTStandard } from "../../domain/types";

const METHOD_OPTIONS: { code: ASTMethod; label: string }[] = [
  { code: ASTMethod.DiskDiffusion, label: "Disk diffusion (mm)" },
  { code: ASTMethod.MIC_Broth, label: "MIC broth (mg/L)" },
  { code: ASTMethod.MIC_Etest, label: "Etest (mg/L)" },
  { code: ASTMethod.Automated_Vitek, label: "Vitek (mg/L)" },
  { code: ASTMethod.Automated_Phoenix, label: "Phoenix (mg/L)" },
];

type ASTEntryControlsProps = {
  antibioticCode: string;
  method: ASTMethod;
  standard: ASTStandard;
  rawValue: string;
  isBloodASTBlocked: boolean;
  onAntibioticCodeChange: (value: string) => void;
  onMethodChange: (value: ASTMethod) => void;
  onStandardChange: (value: ASTStandard) => void;
  onRawValueChange: (value: string) => void;
  onAdd: () => void;
};

export function ASTEntryControls({
  antibioticCode,
  method,
  standard,
  rawValue,
  isBloodASTBlocked,
  onAntibioticCodeChange,
  onMethodChange,
  onStandardChange,
  onRawValueChange,
  onAdd,
}: ASTEntryControlsProps) {
  return (
    <>
      <label className="text-xs">
        <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Antibiotic</span>
        <select
          value={antibioticCode}
          onChange={(e) => onAntibioticCodeChange(e.target.value)}
          className="mt-1 w-full rounded border border-border bg-card px-2 py-1.5 text-sm"
        >
          {ANTIBIOTICS.map((a) => (
            <option key={a.code} value={a.code}>{a.display} ({a.code})</option>
          ))}
        </select>
      </label>
      <label className="text-xs">
        <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Method</span>
        <select
          value={method}
          onChange={(e) => onMethodChange(e.target.value as ASTMethod)}
          className="mt-1 w-full rounded border border-border bg-card px-2 py-1.5 text-sm"
        >
          {METHOD_OPTIONS.map((m) => (
            <option key={m.code} value={m.code}>{m.label}</option>
          ))}
        </select>
      </label>
      <label className="text-xs">
        <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Standard</span>
        <select
          value={standard}
          onChange={(e) => onStandardChange(e.target.value as ASTStandard)}
          className="mt-1 w-full rounded border border-border bg-card px-2 py-1.5 text-sm"
        >
          <option value={PRIMARY_STANDARD}>{PRIMARY_STANDARD} (primary)</option>
          <option value={SECONDARY_STANDARD}>{SECONDARY_STANDARD} (secondary)</option>
        </select>
      </label>
      <label className="text-xs">
        <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
          Raw value
        </span>
        <input
          value={rawValue}
          onChange={(e) => onRawValueChange(e.target.value)}
          inputMode="decimal"
          placeholder={method === ASTMethod.DiskDiffusion ? "mm" : "mg/L"}
          className="mt-1 w-full rounded border border-border bg-card px-2 py-1.5 text-sm"
        />
      </label>
      <div className="md:col-span-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onAdd}
          disabled={isBloodASTBlocked}
          className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          Add AST row
        </button>
        {isBloodASTBlocked && (
          <span className="text-[11px] text-destructive">
            Blood culture AST requires organism linkage to a positive bottle.
          </span>
        )}
      </div>
    </>
  );
}
