import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useDiskDiffStore } from "@/lib/diskdiff-store";

export const Route = createFileRoute("/capture")({ component: CapturePage });

function CapturePage() {
  const { plateRecord, discLayout, setPlateRecord, saveDiscLayoutItem, importLimsWorklistJson } = useDiskDiffStore();
  const [worklistText, setWorklistText] = useState("");
  const [status, setStatus] = useState("");

  const safetyText = useMemo(
    () => [
      "Draft: not for clinical release",
      "Image-assisted disk diffusion reading is for supervised laboratory use",
      "Final AST interpretation requires authorised review",
      "In LIS-connected mode, DiskDiff Reader sends zone measurements and audit metadata. Final interpretation, expert rules, AMS governance, validation, and report release remain in the LIS unless explicitly configured otherwise.",
    ],
    [],
  );

  return <div className="p-4 space-y-4">
    <h1 className="text-xl font-semibold">Capture</h1>
    {safetyText.map((s) => <p key={s} className="text-sm text-muted-foreground">{s}</p>)}
    <textarea className="w-full min-h-32 border p-2" value={worklistText} onChange={(e) => { setWorklistText(e.target.value); setStatus(""); }} placeholder="Paste LIMS worklist JSON" />
    <button className="border px-3 py-1" onClick={() => { const res = importLimsWorklistJson(worklistText); setStatus(res.message); }}>Import LIMS Worklist JSON</button>
    {status ? <p>{status}</p> : null}

    <div className="grid grid-cols-2 gap-2">
      {(["accessionNumber","patientIdentifier","specimenType","organismName","organismGroup","operatingMode","interpretationAuthority","worklistId","isolateId","astPanelId","astPanelName","standard","organismCode","plateBarcode","imageQualityStatus","mediumLot","createdBy"] as const).map((field) => (
        <label key={field} className="text-sm">{field}
          <input className="w-full border p-1" value={(plateRecord as any)[field] ?? ""} onChange={(e) => setPlateRecord({ [field]: e.target.value } as any)} />
        </label>
      ))}
    </div>

    <section>
      <h2 className="font-medium">Disc Layout</h2>
      {discLayout.map((disc) => <div key={disc.id} className="grid grid-cols-7 gap-1 mb-1">
        <input className="border p-1" value={disc.diskPosition} onChange={(e) => saveDiscLayoutItem({ ...disc, diskPosition: e.target.value })} placeholder="diskPosition" />
        <input className="border p-1" value={disc.antibioticCode} onChange={(e) => saveDiscLayoutItem({ ...disc, antibioticCode: e.target.value })} placeholder="antibioticCode" />
        <input className="border p-1" value={disc.antibioticName} onChange={(e) => saveDiscLayoutItem({ ...disc, antibioticName: e.target.value })} placeholder="antibioticName" />
        <input className="border p-1" value={disc.discPotency} onChange={(e) => saveDiscLayoutItem({ ...disc, discPotency: e.target.value })} placeholder="discPotency" />
        <input className="border p-1" value={disc.discLot} onChange={(e) => saveDiscLayoutItem({ ...disc, discLot: e.target.value })} placeholder="discLot" />
        <input className="border p-1" value={disc.discExpiryDate} onChange={(e) => saveDiscLayoutItem({ ...disc, discExpiryDate: e.target.value })} placeholder="discExpiryDate" />
        <label><input type="checkbox" checked={disc.expectedOnPlate} onChange={(e) => saveDiscLayoutItem({ ...disc, expectedOnPlate: e.target.checked })} />expectedOnPlate</label>
      </div>)}
      <button className="border px-3 py-1" onClick={() => saveDiscLayoutItem({})}>Add Disc</button>
    </section>
  </div>;
}
