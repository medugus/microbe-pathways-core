import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  collectedAt: string;
  receivedAt: string;
  onCollectedAtChange: (value: string) => void;
  onReceivedAtChange: (value: string) => void;
}

export function AccessionTimestamps({
  collectedAt,
  receivedAt,
  onCollectedAtChange,
  onReceivedAtChange,
}: Props) {
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="collected">Collection datetime</Label>
        <Input
          id="collected"
          type="datetime-local"
          value={collectedAt}
          onChange={(e) => onCollectedAtChange(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="received">Received datetime</Label>
        <Input
          id="received"
          type="datetime-local"
          value={receivedAt}
          onChange={(e) => onReceivedAtChange(e.target.value)}
        />
      </div>
    </>
  );
}
