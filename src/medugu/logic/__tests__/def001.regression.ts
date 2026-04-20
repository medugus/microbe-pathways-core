/**
 * DEF-001 regression test.
 *
 * Asserts that the seeded CRE sterile-site accession (MB25-CRE001) emits a
 * PHONE_OUT_REQUIRED blocker via runValidation, with no acknowledged phone-out
 * present, when the IPC engine fires CRE_ALERT.
 *
 * This is a pure-logic regression — it imports only the engines and the seed
 * fixtures, so it can be run with `tsx` (or any TS runner) in CI without a
 * browser, without Supabase, and without vitest:
 *
 *   bunx tsx src/medugu/logic/__tests__/def001.regression.ts
 *
 * Exit codes:
 *   0 — DEF-001 contract holds.
 *   1 — DEF-001 regressed: PHONE_OUT_REQUIRED missing or fixture drifted.
 */

import { runValidation } from "../validationEngine";
import { evaluateIPC } from "../ipcEngine";
import { DEMO_ACCESSIONS } from "../../seed/demoAccessions";

const CRE_ID = "MB25-CRE001";

function fail(msg: string): never {
  // eslint-disable-next-line no-console
  console.error(`[DEF-001 REGRESSION FAIL] ${msg}`);
  process.exit(1);
}

function pass(msg: string): void {
  // eslint-disable-next-line no-console
  console.log(`[DEF-001 OK] ${msg}`);
}

const cre = DEMO_ACCESSIONS.find((a) => a.id === CRE_ID);
if (!cre) fail(`Seed accession ${CRE_ID} not found in DEMO_ACCESSIONS.`);

// Sanity: fixture must be sterile-site, no acknowledged phone-out, IPC critical alert firing.
if (cre.specimen.familyCode !== "STERILE_FLUID") {
  fail(`${CRE_ID} fixture drifted: familyCode is ${cre.specimen.familyCode}, expected STERILE_FLUID.`);
}
if (cre.phoneOuts.some((p) => p.acknowledged)) {
  fail(`${CRE_ID} fixture drifted: an acknowledged phone-out is already present, can't test the gate.`);
}

const ipc = evaluateIPC(cre);
const criticalCodes = new Set(["MRSA_ALERT", "VRE_ALERT", "CRE_ALERT", "CRAB_ALERT", "CRPA_ALERT", "CAURIS_ALERT"]);
const hasCriticalIPC = ipc.decisions.some((d) => criticalCodes.has(d.ruleCode));
if (!hasCriticalIPC) {
  fail(
    `${CRE_ID}: IPC engine did not fire any critical alert. Decisions=${JSON.stringify(
      ipc.decisions.map((d) => d.ruleCode),
    )}`,
  );
}
pass(`${CRE_ID}: IPC critical alert firing (${ipc.decisions.map((d) => d.ruleCode).join(", ")}).`);

const report = runValidation(cre);
const blockerCodes = report.blockers.map((b) => b.code);
if (!blockerCodes.includes("PHONE_OUT_REQUIRED")) {
  fail(
    `${CRE_ID}: expected PHONE_OUT_REQUIRED blocker, got blockers=${JSON.stringify(blockerCodes)}.`,
  );
}
if (report.releaseAllowed) {
  fail(`${CRE_ID}: releaseAllowed=true while PHONE_OUT_REQUIRED is the contract — gate is broken.`);
}
pass(`${CRE_ID}: PHONE_OUT_REQUIRED blocker present and releaseAllowed=false.`);

// Inverse check: simulate an acknowledged phone-out, the blocker must clear.
const acked = {
  ...cre,
  phoneOuts: [
    {
      id: "po_test_1",
      at: new Date().toISOString(),
      calledBy: "regression",
      recipient: "Dr. Test",
      reasonCode: "critical_value" as const,
      message: "Acknowledged phone-out for DEF-001 inverse check.",
      acknowledged: true,
      acknowledgedAt: new Date().toISOString(),
    },
  ],
};
const ackedReport = runValidation(acked);
if (ackedReport.blockers.some((b) => b.code === "PHONE_OUT_REQUIRED")) {
  fail(`${CRE_ID}: PHONE_OUT_REQUIRED still blocking after acknowledged phone-out — inverse gate broken.`);
}
pass(`${CRE_ID}: PHONE_OUT_REQUIRED clears after acknowledged phone-out.`);

// eslint-disable-next-line no-console
console.log("[DEF-001 REGRESSION PASS] All assertions held.");
process.exit(0);
