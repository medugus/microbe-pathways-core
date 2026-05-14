import { createFileRoute } from "@tanstack/react-router";
import { useDiskDiffStore } from "@/lib/diskdiff-store";

export const Route = createFileRoute("/measure")({ component: MeasurePage });

function MeasurePage() {
  const { measurements, saveMeasurement, plateRecord } = useDiskDiffStore();
  const validate = (v: string) => {
    const n = Number(v);
    if (Number.isNaN(n)) return null;
    if (n < 6 || n > plateRecord.plateSizeMm) return null;
    return n;
  };
  return <div className="p-4 space-y-2">
    <h1 className="text-xl font-semibold">Measure</h1>
    <p>Draft: not for clinical release</p>
    {measurements.map((m) => <div key={m.id} className="grid grid-cols-7 gap-1">
      <input className="border p-1" value={m.antibioticCode} onChange={(e) => saveMeasurement({ ...m, antibioticCode: e.target.value })} placeholder="antibioticCode" />
      <input className="border p-1" value={m.diskPosition} onChange={(e) => saveMeasurement({ ...m, diskPosition: e.target.value })} placeholder="diskPosition" />
      <input className="border p-1" defaultValue={m.zoneDiameterMm ?? ""} onBlur={(e) => saveMeasurement({ ...m, zoneDiameterMm: validate(e.target.value) })} placeholder="zone mm" />
      <input className="border p-1" value={m.readerConfidence} onChange={(e) => saveMeasurement({ ...m, readerConfidence: e.target.value as any })} placeholder="readerConfidence" />
      <input className="border p-1" value={m.measurementSource} onChange={(e) => saveMeasurement({ ...m, measurementSource: e.target.value as any })} placeholder="measurementSource" />
      <input className="border p-1" value={m.reviewStatus} onChange={(e) => saveMeasurement({ ...m, reviewStatus: e.target.value as any })} placeholder="reviewStatus" />
      <label><input type="checkbox" checked={m.manualEdited} onChange={(e) => saveMeasurement({ ...m, manualEdited: e.target.checked })} />manualEdited</label>
      <input className="border p-1 col-span-2" value={m.overrideReason} onChange={(e) => saveMeasurement({ ...m, overrideReason: e.target.value })} placeholder="overrideReason" />
    </div>)}
    <button className="border px-3 py-1" onClick={() => saveMeasurement({})}>Add measurement</button>
  </div>;
}
