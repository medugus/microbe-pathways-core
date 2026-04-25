import { ASTMethod } from "../../domain/enums";

type ASTRawValueCellProps = {
  value: number | undefined;
  method: ASTMethod;
  rawUnit: "mm" | "mg/L" | undefined;
  onRawValueChange: (nextRawValue: number | undefined) => void;
  onRawUnitChange: (nextRawUnit: "mm" | "mg/L") => void;
};

export function ASTRawValueCell({
  value,
  method,
  rawUnit,
  onRawValueChange,
  onRawUnitChange,
}: ASTRawValueCellProps) {
  const effectiveUnit = method === ASTMethod.DiskDiffusion ? "mm" : "mg/L";

  return (
    <div className="grid grid-cols-[1fr_auto] gap-1">
      <input
        type="number"
        step="any"
        value={value ?? ""}
        onChange={(e) => {
          const nextRawValue = e.target.value.trim() === "" ? undefined : Number(e.target.value);
          onRawValueChange(Number.isFinite(nextRawValue) ? nextRawValue : undefined);
        }}
        placeholder={effectiveUnit}
        className="w-full rounded border border-border bg-background px-1.5 py-0.5 text-[10px]"
        title="Raw AST value"
      />
      <select
        value={rawUnit ?? effectiveUnit}
        onChange={(e) => onRawUnitChange(e.target.value as "mm" | "mg/L")}
        className="rounded border border-border bg-background px-1 py-0.5 text-[10px]"
      >
        <option value={effectiveUnit}>{effectiveUnit}</option>
      </select>
    </div>
  );
}
