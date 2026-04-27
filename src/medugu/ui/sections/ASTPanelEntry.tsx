import { getAntibiotic, type ASTPanelDef } from "../../config/antibiotics";
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

type ASTPanelEntryProps = {
  selectedPanelId: string;
  eligiblePanels: ASTPanelDef[];
  method: ASTMethod;
  standard: ASTStandard;
  panelPendingCount: number;
  panelDuplicateCount: number;
  selectedPanelCodes: string[];
  selectedPanelMissingRequested: string[];
  panelSummary: string | null;
  isBloodASTBlocked: boolean;
  isPanelEligible: boolean;
  onPanelChange: (value: string) => void;
  onMethodChange: (value: ASTMethod) => void;
  onStandardChange: (value: ASTStandard) => void;
  onAddPanel: () => void;
};

export function ASTPanelEntry({
  selectedPanelId,
  eligiblePanels,
  method,
  standard,
  panelPendingCount,
  panelDuplicateCount,
  selectedPanelCodes,
  selectedPanelMissingRequested,
  panelSummary,
  isBloodASTBlocked,
  isPanelEligible,
  onPanelChange,
  onMethodChange,
  onStandardChange,
  onAddPanel,
}: ASTPanelEntryProps) {
  const isAddPanelBlocked = isBloodASTBlocked || !isPanelEligible;

  return (
    <>
      <label className="text-xs md:col-span-2">
        <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
          Panel
        </span>
        <select
          value={selectedPanelId}
          onChange={(e) => onPanelChange(e.target.value)}
          className="mt-1 w-full rounded border border-border bg-card px-2 py-1.5 text-sm"
        >
          {eligiblePanels.map((panel) => (
            <option key={panel.id} value={panel.id}>
              {panel.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Panels are filtered by organism group.
        </p>
      </label>
      <label className="text-xs">
        <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
          Method
        </span>
        <select
          value={method}
          onChange={(e) => onMethodChange(e.target.value as ASTMethod)}
          className="mt-1 w-full rounded border border-border bg-card px-2 py-1.5 text-sm"
        >
          {METHOD_OPTIONS.map((m) => (
            <option key={m.code} value={m.code}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs">
        <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
          Standard
        </span>
        <select
          value={standard}
          onChange={(e) => onStandardChange(e.target.value as ASTStandard)}
          className="mt-1 w-full rounded border border-border bg-card px-2 py-1.5 text-sm"
        >
          <option value={PRIMARY_STANDARD}>{PRIMARY_STANDARD} (primary)</option>
          <option value={SECONDARY_STANDARD}>{SECONDARY_STANDARD} (secondary)</option>
        </select>
      </label>
      <div className="md:col-span-4 flex items-end">
        <button
          type="button"
          onClick={onAddPanel}
          disabled={isAddPanelBlocked}
          className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          Add panel
        </button>
        {isBloodASTBlocked && (
          <span className="ml-2 text-[11px] text-destructive">
            Blood culture AST requires organism linkage to a positive bottle.
          </span>
        )}
        {!isPanelEligible && (
          <span className="ml-2 text-[11px] text-destructive">
            This AST panel is not appropriate for the selected organism group.
          </span>
        )}
      </div>
      <div className="md:col-span-6 rounded border border-border bg-card px-2 py-2 text-[11px] text-muted-foreground">
        <div className="font-medium text-foreground">Panel preview</div>
        <div className="mt-1">
          Will add {panelPendingCount} row(s); {panelDuplicateCount} duplicate(s) detected for
          isolate.
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {selectedPanelCodes.map((code) => (
            <span key={code} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
              {getAntibiotic(code)?.display ?? code} ({code})
            </span>
          ))}
        </div>
        {selectedPanelMissingRequested.length > 0 && (
          <div className="mt-2">
            <span className="font-medium text-foreground">Missing requested:</span>{" "}
            {selectedPanelMissingRequested.join(", ")}
          </div>
        )}
      </div>
      {panelSummary && (
        <p className="md:col-span-6 text-[11px] text-muted-foreground">{panelSummary}</p>
      )}
    </>
  );
}
