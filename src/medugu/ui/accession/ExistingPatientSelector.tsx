import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Patient } from "../../domain/types";

interface Props {
  existingMrn: string;
  existingMrnMissing: boolean;
  existingPatients: Patient[];
  onExistingMrnChange: (value: string) => void;
}

export function ExistingPatientSelector({
  existingMrn,
  existingMrnMissing,
  existingPatients,
  onExistingMrnChange,
}: Props) {
  return (
    <div className="space-y-1">
      <Label>
        Patient / MRN <span className="text-destructive">*</span>
      </Label>
      <Select value={existingMrn} onValueChange={onExistingMrnChange}>
        <SelectTrigger
          aria-invalid={existingMrnMissing}
          aria-describedby={existingMrnMissing ? "existing-mrn-required" : undefined}
        >
          <SelectValue placeholder="Select an existing patient" />
        </SelectTrigger>
        <SelectContent>
          {existingPatients.map((p) => (
            <SelectItem key={p.mrn} value={p.mrn}>
              {p.familyName}, {p.givenName} — MRN {p.mrn}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {existingMrnMissing ? (
        <p id="existing-mrn-required" className="text-[11px] text-destructive">
          Select a patient/MRN to create an accession for an existing record.
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Required to link this accession to an existing patient identifier.
        </p>
      )}
    </div>
  );
}
