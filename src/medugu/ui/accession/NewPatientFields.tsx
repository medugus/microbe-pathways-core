import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sex } from "../../domain/enums";

interface Props {
  givenName: string;
  familyName: string;
  mrn: string;
  sex: Sex;
  mrnMissing: boolean;
  onGivenNameChange: (value: string) => void;
  onFamilyNameChange: (value: string) => void;
  onMrnChange: (value: string) => void;
  onSexChange: (value: Sex) => void;
}

export function NewPatientFields({
  givenName,
  familyName,
  mrn,
  sex,
  mrnMissing,
  onGivenNameChange,
  onFamilyNameChange,
  onMrnChange,
  onSexChange,
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label htmlFor="given">Given name</Label>
        <Input id="given" value={givenName} onChange={(e) => onGivenNameChange(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="family">Family name</Label>
        <Input
          id="family"
          value={familyName}
          onChange={(e) => onFamilyNameChange(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="mrn">
          MRN / Identifier <span className="text-destructive">*</span>
        </Label>
        <Input
          id="mrn"
          value={mrn}
          onChange={(e) => onMrnChange(e.target.value)}
          aria-invalid={mrnMissing}
          aria-describedby={mrnMissing ? "mrn-required" : undefined}
        />
        {mrnMissing ? (
          <p id="mrn-required" className="text-[11px] text-destructive">
            MRN / Identifier is required to create a new accession.
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Required for patient identity and release validation.
          </p>
        )}
      </div>
      <div className="space-y-1">
        <Label>Sex</Label>
        <Select value={sex} onValueChange={(v) => onSexChange(v as Sex)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(Sex).map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
