import { Label } from "@/components/ui/label";
import { BLOOD_WORKUP_PRESETS } from "../../config/bloodCulturePresets";
import { cn } from "@/lib/utils";

const BLOOD_SOURCE_CHIPS: Array<{ code: string; label: string }> = [
  { code: "BC_PERIPHERAL", label: "Peripheral venepuncture" },
  { code: "BC_CENTRAL_LINE", label: "Central line" },
  { code: "BC_ARTERIAL", label: "Arterial line" },
  { code: "BC_PERIPHERAL_CANNULA", label: "Peripheral cannula" },
  { code: "BC_PORTACATH", label: "Portacath" },
  { code: "BC_NEONATAL", label: "Neonatal" },
];

const BLOOD_PRESET_CHIPS = BLOOD_WORKUP_PRESETS.filter((p) =>
  [
    "STANDARD_ADULT",
    "PAEDIATRIC_WORKUP",
    "CLABSI_WORKUP",
    "ENDOCARDITIS_WORKUP",
    "FUNGAEMIA_WORKUP",
  ].includes(p.code),
);

interface Props {
  bloodPreset: string;
  bloodSources: string[];
  onBloodPresetChange: (value: string) => void;
  onToggleBloodSource: (value: string) => void;
}

export function NewAccessionBloodSetup({
  bloodPreset,
  bloodSources,
  onBloodPresetChange,
  onToggleBloodSource,
}: Props) {
  return (
    <>
      <div className="space-y-2 col-span-2">
        <Label>Workup preset</Label>
        <div className="flex flex-wrap gap-1.5">
          {BLOOD_PRESET_CHIPS.map((p) => {
            const active = bloodPreset === p.code;
            return (
              <button
                key={p.code}
                type="button"
                onClick={() => onBloodPresetChange(p.code)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-accent",
                )}
              >
                {p.display.split(" (")[0]}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Detailed set/site editing available in Collection Details after creation.
        </p>
      </div>

      <div className="space-y-2 col-span-2">
        <Label>
          Source(s) <span className="text-muted-foreground font-normal">— select one or more</span>
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {BLOOD_SOURCE_CHIPS.map((s) => {
            const active = bloodSources.includes(s.code);
            return (
              <button
                key={s.code}
                type="button"
                onClick={() => onToggleBloodSource(s.code)}
                aria-pressed={active}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background hover:bg-accent",
                )}
              >
                {active ? "✓ " : ""}
                {s.label}
              </button>
            );
          })}
        </div>
        {bloodSources.length === 0 && (
          <p className="text-[11px] text-destructive">Select at least one source.</p>
        )}
      </div>
    </>
  );
}
