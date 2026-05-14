import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useDiskDiffStore } from "@/lib/diskdiff-store";

export const Route = createFileRoute("/reports")({ component: ReportsPage });

function ReportsPage() {
  const { exportZoneResultJson, validateZoneResultExport } = useDiskDiffStore();
  const [output, setOutput] = useState("");
  const warnings = useMemo(() => validateZoneResultExport(), [validateZoneResultExport, output]);

  return <div className="p-4 space-y-3">
    <h1 className="text-xl font-semibold">Reports</h1>
    <p>Draft: not for clinical release</p>
    <button className="border px-3 py-1" onClick={() => setOutput(JSON.stringify(exportZoneResultJson().payload, null, 2))}>Export Zone Result JSON</button>
    {warnings.length ? <ul className="text-amber-700 list-disc ml-5">{warnings.map((w) => <li key={w}>{w}</li>)}</ul> : <p>No validation warnings.</p>}
    <textarea className="w-full min-h-64 border p-2" value={output} readOnly />
  </div>;
}
