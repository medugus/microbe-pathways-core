// SpecimenFieldsForm — editable inputs for the resolver's required/optional fields.
// Pure UI: writes captured values into accession.specimen.details and persists
// via meduguActions.upsertAccession. No clinical rule logic lives here.

import { useEffect, useMemo, useState } from "react";
import { meduguActions } from "../../store/useAccessionStore";
import type { Accession } from "../../domain/types";
import type { FieldKey } from "../../logic/specimenResolver";
import { BloodSetsForm } from "./BloodSetsForm";
import {
  getAllowedCollectionMethodsForSpecimen,
  getCollectionMethodGuidanceForSpecimen,
  getDefaultCollectionMethodForSpecimen,
  isCollectionMethodCompatibleWithSpecimen,
} from "../../logic/specimenCompatibility";

const FIELD_LABELS: Record<string, string> = {
  setCount: "Number of sets",
  bottleType: "Bottle types",
  drawSite: "Draw site",
  drawTime: "Draw time",
  contaminationContext: "Contamination context",
  neonatalWeight: "Neonatal weight (g)",
  collectionMethodNote: "Collection method note",
  catheterInSituDays: "Catheter in-situ (days)",
  contaminationNotes: "Contamination notes",
  ventilatorStatus: "Ventilator status",
  specimenVolumeMl: "Specimen volume (mL)",
  anatomicSite: "Anatomic site",
  imageGuidance: "Image guidance",
  drainSiteDays: "Drain in-situ (days)",
  screenRound: "Screen round",
  priorPositive: "Prior positive",
};

// ---- coded option lists (display-only labels) ----
const BOTTLE_TYPES = [
  { code: "AEROBIC", display: "Aerobic" },
  { code: "ANAEROBIC", display: "Anaerobic" },
  { code: "PAEDIATRIC", display: "Paediatric" },
  { code: "MYCOLOGY", display: "Mycology / fungal" },
  { code: "MYCOBACTERIAL", display: "Mycobacterial (AFB)" },
  { code: "ISOLATOR", display: "Isolator / lysis-centrifugation" },
];

const DRAW_SITES = [
  { code: "PERIPHERAL_LEFT", display: "Peripheral — left arm" },
  { code: "PERIPHERAL_RIGHT", display: "Peripheral — right arm" },
  { code: "PERIPHERAL_OTHER", display: "Peripheral — other" },
  { code: "CENTRAL_LINE", display: "Central line" },
  { code: "ARTERIAL_LINE", display: "Arterial line" },
  { code: "PERIPHERAL_CANNULA", display: "Peripheral cannula" },
  { code: "PORTACATH", display: "Portacath" },
  { code: "FEMORAL", display: "Femoral" },
];

const CONTAMINATION_CONTEXT = [
  { code: "PAIRED_PERIPHERAL_DRAWN", display: "Paired peripheral drawn" },
  { code: "LINE_ONLY", display: "Line only — no peripheral" },
  { code: "SUSPECTED_HUB_CONTAM", display: "Suspected hub contamination" },
  { code: "SKIN_PREP_INADEQUATE", display: "Skin prep inadequate" },
];

const VENT_STATUS = [
  { code: "NOT_VENTILATED", display: "Not ventilated" },
  { code: "INVASIVE_VENT", display: "Invasive ventilation" },
  { code: "NIV", display: "Non-invasive ventilation" },
  { code: "RECENT_EXTUBATION", display: "Recent extubation" },
];

const IMAGE_GUIDANCE = [
  { code: "ULTRASOUND", display: "Ultrasound-guided" },
  { code: "CT", display: "CT-guided" },
  { code: "FLUORO", display: "Fluoroscopy-guided" },
  { code: "NONE", display: "Not image-guided" },
];

const COLLECTION_METHOD_NOTES_URINE = [
  { code: "MIDSTREAM_CLEAN_CATCH", display: "Midstream — clean catch" },
  { code: "MIDSTREAM", display: "Midstream" },
  { code: "SELF_COLLECTED_CLEAN_CATCH", display: "Self-collected clean catch" },
  { code: "IN_OUT_CATHETER", display: "In-out catheter" },
  { code: "INTERMITTENT_CATHETERISATION", display: "Intermittent catheterisation" },
  { code: "INDWELLING_CATHETER", display: "Indwelling catheter" },
  { code: "CATHETER_SAMPLING_PORT", display: "Catheter sampling port" },
  { code: "NEWLY_INSERTED_CATHETER", display: "Newly inserted catheter" },
  { code: "CLEANED_STOMA_CONDUIT_COLLECTION", display: "Cleaned stoma/conduit collection" },
  { code: "CATHETERISED_CONDUIT_SPECIMEN", display: "Catheterised conduit specimen" },
  { code: "FRESHLY_APPLIED_UROSTOMY_APPLIANCE", display: "Freshly applied urostomy appliance" },
  { code: "NEPHROSTOMY_TUBE_SAMPLING", display: "Nephrostomy tube sampling" },
  { code: "FRESHLY_ACCESSED_NEPHROSTOMY_PORT", display: "Freshly accessed nephrostomy port" },
  { code: "SUPRAPUBIC_NEEDLE_ASPIRATE", display: "Suprapubic needle aspirate" },
  { code: "SPA", display: "Suprapubic aspirate" },
  { code: "FIRST_VOID", display: "First-void urine" },
  { code: "FIRST_CATCH", display: "First-catch urine" },
  { code: "RANDOM_VOIDED", display: "Random voided urine" },
  { code: "CLEAN_CATCH", display: "Clean catch urine" },
  { code: "PAEDIATRIC_URINE_BAG", display: "Paediatric urine bag" },
  { code: "PAEDIATRIC_BAG", display: "Paediatric collection bag" },
];

const COLLECTION_METHOD_NOTES_LRT = [
  { code: "EXPECTORATED", display: "Expectorated sputum" },
  { code: "INDUCED", display: "Induced sputum" },
  { code: "ETA", display: "Endotracheal aspirate" },
  { code: "BAL", display: "Bronchoalveolar lavage" },
  { code: "BRONCH_WASH", display: "Bronchial wash" },
];

const SCREEN_ROUNDS = [
  { code: "ADMISSION", display: "Admission screen" },
  { code: "WEEKLY", display: "Weekly screen" },
  { code: "POST_EXPOSURE", display: "Post-exposure screen" },
  { code: "CLEARANCE_1", display: "Clearance — round 1" },
  { code: "CLEARANCE_2", display: "Clearance — round 2" },
  { code: "CLEARANCE_3", display: "Clearance — round 3" },
];

interface Props {
  accession: Accession;
  required: FieldKey[];
  optional: FieldKey[];
}

export function SpecimenFieldsForm({ accession, required, optional }: Props) {
  const details = accession.specimen.details ?? {};
  const [collectionResetWarning, setCollectionResetWarning] = useState(false);

  function update(field: string, value: unknown) {
    const nextDetails: Record<string, unknown> = { ...details };
    if (value === "" || value === undefined || value === null) {
      delete nextDetails[field];
    } else {
      nextDetails[field] = value;
    }
    meduguActions.upsertAccession({
      ...accession,
      specimen: { ...accession.specimen, details: nextDetails },
    });
  }

  const familyCode = accession.specimen.familyCode;
  const subtypeCode = accession.specimen.subtypeCode;
  const collectionMethodCode =
    typeof details.collectionMethodNote === "string" ? details.collectionMethodNote : "";
  const allowedCollectionMethods = useMemo(
    () => getAllowedCollectionMethodsForSpecimen(familyCode, subtypeCode),
    [familyCode, subtypeCode],
  );
  const urineCollectionMethodOptions = useMemo(() => {
    if (familyCode !== "URINE") return COLLECTION_METHOD_NOTES_URINE;
    if (!allowedCollectionMethods) return COLLECTION_METHOD_NOTES_URINE;
    return COLLECTION_METHOD_NOTES_URINE.filter((o) => allowedCollectionMethods.includes(o.code));
  }, [allowedCollectionMethods, familyCode]);
  const collectionGuidance = useMemo(
    () => getCollectionMethodGuidanceForSpecimen(familyCode, subtypeCode),
    [familyCode, subtypeCode],
  );

  useEffect(() => {
    if (familyCode !== "URINE") {
      setCollectionResetWarning(false);
      return;
    }
    if (!collectionMethodCode) {
      setCollectionResetWarning(false);
      return;
    }
    if (isCollectionMethodCompatibleWithSpecimen(familyCode, subtypeCode, collectionMethodCode)) {
      return;
    }

    const fallback = getDefaultCollectionMethodForSpecimen(familyCode, subtypeCode) ?? "";
    const nextDetails: Record<string, unknown> = { ...details };
    if (fallback) nextDetails.collectionMethodNote = fallback;
    else delete nextDetails.collectionMethodNote;
    meduguActions.upsertAccession({
      ...accession,
      specimen: { ...accession.specimen, details: nextDetails },
    });
    setCollectionResetWarning(true);
  }, [accession, collectionMethodCode, details, familyCode, subtypeCode]);

  const renderField = (field: FieldKey) => {
    const label = FIELD_LABELS[field] ?? field;
    const value = (details[field] ?? "") as string | number | string[];

    switch (field) {
      case "setCount":
        return (
          <NumberSelect
            label={label}
            value={value as number | ""}
            options={[1, 2, 3, 4]}
            onChange={(v) => update(field, v)}
            help="Standard adult workup: 2 sets. Endocarditis workup: up to 4."
          />
        );
      case "bottleType":
        return (
          <MultiSelect
            label={label}
            value={Array.isArray(value) ? value : []}
            options={BOTTLE_TYPES}
            onChange={(v) => update(field, v)}
            help="Tick every bottle type drawn (e.g. aerobic + anaerobic + mycology)."
          />
        );
      case "drawSite":
        return (
          <CodedSelect
            label={label}
            value={String(value)}
            options={DRAW_SITES}
            onChange={(v) => update(field, v)}
          />
        );
      case "drawTime":
        return (
          <DateTimeInput label={label} value={String(value)} onChange={(v) => update(field, v)} />
        );
      case "contaminationContext":
        return (
          <CodedSelect
            label={label}
            value={String(value)}
            options={CONTAMINATION_CONTEXT}
            onChange={(v) => update(field, v)}
          />
        );
      case "neonatalWeight":
      case "specimenVolumeMl":
      case "catheterInSituDays":
      case "drainSiteDays":
        return (
          <NumberInput
            label={label}
            value={value as number | ""}
            onChange={(v) => update(field, v)}
          />
        );
      case "ventilatorStatus":
        return (
          <CodedSelect
            label={label}
            value={String(value)}
            options={VENT_STATUS}
            onChange={(v) => update(field, v)}
          />
        );
      case "imageGuidance":
        return (
          <CodedSelect
            label={label}
            value={String(value)}
            options={IMAGE_GUIDANCE}
            onChange={(v) => update(field, v)}
          />
        );
      case "collectionMethodNote":
        return (
          <div className="space-y-1">
            <CodedSelect
              label={label}
              value={String(value)}
              options={
                familyCode === "URINE"
                  ? urineCollectionMethodOptions
                  : familyCode === "LRT"
                    ? COLLECTION_METHOD_NOTES_LRT
                    : []
              }
              onChange={(v) => {
                setCollectionResetWarning(false);
                update(field, v);
              }}
              allowFreeText
            />
            {collectionResetWarning && (
              <p className="text-[11px] text-amber-700 dark:text-amber-500">
                Collection method reset because it is not compatible with the selected specimen
                type.
              </p>
            )}
            {collectionGuidance && (
              <p className="text-[11px] text-muted-foreground">{collectionGuidance}</p>
            )}
          </div>
        );
      case "anatomicSite":
        return (
          <TextInput
            label={label}
            value={String(value)}
            placeholder="e.g. Right knee, lumbar puncture"
            onChange={(v) => update(field, v)}
          />
        );
      case "screenRound":
        return (
          <CodedSelect
            label={label}
            value={String(value)}
            options={SCREEN_ROUNDS}
            onChange={(v) => update(field, v)}
          />
        );
      case "priorPositive":
        return (
          <CodedSelect
            label={label}
            value={String(value)}
            options={[
              { code: "YES", display: "Yes — prior positive" },
              { code: "NO", display: "No prior positive" },
              { code: "UNKNOWN", display: "Unknown" },
            ]}
            onChange={(v) => update(field, v)}
          />
        );
      case "contaminationNotes":
        return (
          <TextInput
            label={label}
            value={String(value)}
            placeholder="Free text"
            onChange={(v) => update(field, v)}
          />
        );
      default:
        return <TextInput label={label} value={String(value)} onChange={(v) => update(field, v)} />;
    }
  };

  // For blood cultures, the per-set composer replaces the legacy flat fields
  // (setCount, bottleType, drawSite, drawTime). Render any *remaining* required
  // / optional fields (e.g. neonatalWeight, contaminationContext) below it.
  const isBlood = accession.specimen.familyCode === "BLOOD";
  const BLOOD_HANDLED: FieldKey[] = ["setCount", "bottleType", "drawSite", "drawTime"];

  const visibleRequired = isBlood ? required.filter((f) => !BLOOD_HANDLED.includes(f)) : required;
  const visibleOptional = isBlood ? optional.filter((f) => !BLOOD_HANDLED.includes(f)) : optional;

  const allFields = useMemo(
    () => [
      ...visibleRequired.map((f) => ({ field: f, isRequired: true })),
      ...visibleOptional.map((f) => ({ field: f, isRequired: false })),
    ],
    [visibleRequired, visibleOptional],
  );

  if (isBlood) {
    return (
      <div className="space-y-4">
        <BloodSetsForm accession={accession} />
        {allFields.length > 0 && (
          <div className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-card p-4 md:grid-cols-2">
            {allFields.map(({ field, isRequired }) => (
              <div key={field} className="min-w-0">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {FIELD_LABELS[field] ?? field}
                    {isRequired && <span className="ml-1 text-destructive">*</span>}
                  </span>
                  {!isRequired && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] uppercase text-muted-foreground">
                      optional
                    </span>
                  )}
                </div>
                {renderField(field)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (allFields.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No collection fields required for this specimen.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-card p-4 md:grid-cols-2">
      {allFields.map(({ field, isRequired }) => (
        <div key={field} className="min-w-0">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {FIELD_LABELS[field] ?? field}
              {isRequired && <span className="ml-1 text-destructive">*</span>}
            </span>
            {!isRequired && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] uppercase text-muted-foreground">
                optional
              </span>
            )}
          </div>
          {renderField(field)}
        </div>
      ))}
    </div>
  );
}

// ---- field widgets ----

function NumberSelect({
  label,
  value,
  options,
  onChange,
  help,
}: {
  label: string;
  value: number | "";
  options: number[];
  onChange: (v: number | "") => void;
  help?: string;
}) {
  return (
    <div>
      <select
        aria-label={label}
        value={value === "" ? "" : String(value)}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
      >
        <option value="">— select —</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {help && <p className="mt-1 text-[10px] text-muted-foreground">{help}</p>}
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | "";
  onChange: (v: number | "") => void;
}) {
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      value={value === "" ? "" : String(value)}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "") return onChange("");
        const n = Number(v);
        if (Number.isFinite(n)) onChange(n);
      }}
      className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
    />
  );
}

function TextInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      aria-label={label}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
    />
  );
}

function DateTimeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  // Convert ISO to datetime-local format if needed
  const localValue = value && value.length >= 16 ? value.slice(0, 16) : value;
  return (
    <input
      aria-label={label}
      type="datetime-local"
      value={localValue}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
    />
  );
}

function CodedSelect({
  label,
  value,
  options,
  onChange,
  allowFreeText,
}: {
  label: string;
  value: string;
  options: { code: string; display: string }[];
  onChange: (v: string) => void;
  allowFreeText?: boolean;
}) {
  const isCustom = allowFreeText && value !== "" && !options.some((o) => o.code === value);
  return (
    <div className="space-y-1">
      <select
        aria-label={label}
        value={isCustom ? "__custom__" : value}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__custom__") onChange("CUSTOM_");
          else onChange(v);
        }}
        className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
      >
        <option value="">— select —</option>
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.display}
          </option>
        ))}
        {allowFreeText && <option value="__custom__">Other (free text)…</option>}
      </select>
      {isCustom && (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Custom value"
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
        />
      )}
    </div>
  );
}

function MultiSelect({
  label,
  value,
  options,
  onChange,
  help,
}: {
  label: string;
  value: string[];
  options: { code: string; display: string }[];
  onChange: (v: string[]) => void;
  help?: string;
}) {
  function toggle(code: string) {
    if (value.includes(code)) onChange(value.filter((c) => c !== code));
    else onChange([...value, code]);
  }
  return (
    <div>
      <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = value.includes(o.code);
          return (
            <button
              key={o.code}
              type="button"
              onClick={() => toggle(o.code)}
              className={`rounded border px-2 py-1 text-xs transition ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted"
              }`}
            >
              {active ? "✓ " : ""}
              {o.display}
            </button>
          );
        })}
      </div>
      {help && <p className="mt-1 text-[10px] text-muted-foreground">{help}</p>}
    </div>
  );
}
