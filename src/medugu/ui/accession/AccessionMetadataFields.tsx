import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Priority } from "../../domain/enums";

interface Props {
  ward: string;
  accessionNumber: string;
  accessionExists: boolean;
  priority: Priority;
  onWardChange: (value: string) => void;
  onAccessionNumberChange: (value: string) => void;
  onAutoAccessionNumber: () => void;
  onPriorityChange: (value: Priority) => void;
}

export function AccessionMetadataFields({
  ward,
  accessionNumber,
  accessionExists,
  priority,
  onWardChange,
  onAccessionNumberChange,
  onAutoAccessionNumber,
  onPriorityChange,
}: Props) {
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="ward">Ward / location</Label>
        <Input
          id="ward"
          value={ward}
          onChange={(e) => onWardChange(e.target.value)}
          placeholder="e.g. ICU-3"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="acc">Accession number</Label>
        <div className="flex gap-2">
          <Input
            id="acc"
            value={accessionNumber}
            onChange={(e) => onAccessionNumberChange(e.target.value.trim())}
          />
          <Button type="button" variant="outline" size="sm" onClick={onAutoAccessionNumber}>
            Auto
          </Button>
        </div>
        {accessionExists && <p className="text-[11px] text-destructive">Number already in use.</p>}
      </div>

      <div className="space-y-1">
        <Label>Priority</Label>
        <Select value={priority} onValueChange={(v) => onPriorityChange(v as Priority)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(Priority).map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
