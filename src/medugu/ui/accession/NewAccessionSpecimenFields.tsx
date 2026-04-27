import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SPECIMEN_FAMILIES } from "../../config/specimenFamilies";

interface Subtype {
  code: string;
  display: string;
}

interface Props {
  familyCode: string;
  subtypeCode: string;
  subtypes: Subtype[];
  showSubtype: boolean;
  onFamilyChange: (value: string) => void;
  onSubtypeChange: (value: string) => void;
}

export function NewAccessionSpecimenFields({
  familyCode,
  subtypeCode,
  subtypes,
  showSubtype,
  onFamilyChange,
  onSubtypeChange,
}: Props) {
  return (
    <>
      <div className="space-y-1">
        <Label>Specimen family</Label>
        <Select value={familyCode} onValueChange={onFamilyChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SPECIMEN_FAMILIES.map((f) => (
              <SelectItem key={f.code} value={f.code}>
                {f.display}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showSubtype && (
        <div className="space-y-1 col-span-2">
          <Label>Specimen subtype</Label>
          <Select value={subtypeCode} onValueChange={onSubtypeChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {subtypes.map((s) => (
                <SelectItem key={s.code} value={s.code}>
                  {s.display}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  );
}
