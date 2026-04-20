import { DEMO_ACCESSIONS } from "./medugu/seed/demoAccessions";
import { runValidation } from "./medugu/logic/validationEngine";
import { evaluateIPC } from "./medugu/logic/ipcEngine";
import { evaluateIsolate } from "./medugu/logic/astEngine";
import { evaluateExportGate } from "./medugu/logic/exportEngine";

const byId: Record<string, any> = {};
for (const a of DEMO_ACCESSIONS) byId[a.id] = a;

const TARGETS = ["MB25-EF34GH","MB25-AB12CD","MB25-CRE001","MB25-NP78QR","MB25-JK56LM","MB25-ST90UV"];

for (const id of TARGETS) {
  const a = byId[id];
  if (!a) { console.log(id, "MISSING"); continue; }
  const v = runValidation(a);
  const ipc = evaluateIPC(a, byId);
  const phen = a.isolates.flatMap((i: any) => evaluateIsolate(a, i).phenotypeFlags);
  const gate = evaluateExportGate(a);
  console.log(JSON.stringify({
    id,
    blockers: v.blockers.map((b: any) => b.code),
    warnings: v.warnings.map((w: any) => w.code),
    info: v.info.map((i: any) => i.code),
    releaseAllowed: v.releaseAllowed,
    ipcRules: ipc.decisions.map((d: any) => d.ruleCode),
    ipcNew: ipc.decisions.map((d: any) => ({ rule: d.ruleCode, newEpisode: d.isNewEpisode })),
    phenotypes: Array.from(new Set(phen)),
    exportAvailable: gate.allowed,
    exportReason: gate.reason,
    releaseState: a.release?.state,
    isolates: a.isolates.map((i: any) => ({ org: i.organismCode, sig: i.significance })),
    astCodes: a.ast.map((x: any) => `${x.antibioticCode}=${x.finalInterpretation ?? "-"}`),
  }));
}
