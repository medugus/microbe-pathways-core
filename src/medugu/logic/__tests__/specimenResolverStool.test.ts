// Unit tests for resolveStool — covers all 5 stool subtypes via resolveSpecimen().
// Style matches existing __tests__ files: plain assert(), no vitest harness.

import { describe, it } from "vitest";
import { resolveSpecimen } from "../specimenResolver";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function getProfile(subtypeCode: string) {
  const result = resolveSpecimen("STOOL", subtypeCode);
  assert(result.ok, `resolveSpecimen STOOL/${subtypeCode} should be ok`);
  if (!result.ok) throw new Error("unreachable");
  return result.profile;
}

// ---------- STOOL_ROUTINE ----------
{
  const p = getProfile("STOOL_ROUTINE");
  assert(p.familyCode === "STOOL", "routine: family STOOL");
  assert(p.acceptance.mode === "qualified", "routine: qualified acceptance");
  assert(
    p.acceptance.rejectionReasonCodes.includes("STOOL_DELAYED") &&
      p.acceptance.rejectionReasonCodes.includes("STOOL_INSUFFICIENT") &&
      p.acceptance.rejectionReasonCodes.includes("STOOL_LEAKED"),
    "routine: standard rejection codes",
  );
  assert(p.requiredFields.includes("stoolConsistency"), "routine: requires stoolConsistency");
  assert(p.workbenchPanels.includes("stool_enteric_panel"), "routine: enteric panel");
  assert(p.syndrome === "infectious_diarrhoea", "routine: syndrome diarrhoea");
  assert(
    p.reportSections.includes("culture") && p.reportSections.includes("ast"),
    "routine: culture + ast sections",
  );
  assert(p.ipcFlagHints.length === 0, "routine: no IPC hints by default");
  assert(p.microscopy.required.length === 0, "routine: no required microscopy");
}

// ---------- STOOL_CDIFF ----------
{
  const p = getProfile("STOOL_CDIFF");
  assert(p.acceptance.mode === "rejectable", "cdiff: rejectable acceptance");
  assert(
    p.acceptance.rejectionReasonCodes.includes("STOOL_FORMED_CDIFF"),
    "cdiff: rejects formed stool",
  );
  assert(
    p.acceptance.rejectionReasonCodes.includes("STOOL_RECTAL_SWAB_CDIFF"),
    "cdiff: rejects rectal swab",
  );
  assert(p.workbenchPanels.includes("stool_cdiff_panel"), "cdiff: cdiff panel");
  assert(p.syndrome === "cdiff_infection", "cdiff: syndrome cdiff");
  assert(
    !p.reportSections.includes("ast"),
    "cdiff: no AST report section (toxin/PCR workflow)",
  );
}

// ---------- STOOL_OVA_PARASITES ----------
{
  const p = getProfile("STOOL_OVA_PARASITES");
  assert(p.acceptance.mode === "qualified", "o&p: qualified acceptance");
  assert(
    p.acceptance.rejectionReasonCodes.includes("STOOL_PRESERVATIVE_MISSING"),
    "o&p: preservative missing rejectable",
  );
  assert(p.microscopy.required.includes("wetMount"), "o&p: requires wet mount");
  assert(
    p.workbenchPanels.includes("stool_parasitology_panel"),
    "o&p: parasitology panel",
  );
  assert(p.syndrome === "intestinal_parasitosis", "o&p: parasitosis syndrome");
  assert(
    p.reportSections.includes("microscopy"),
    "o&p: microscopy report section",
  );
}

// ---------- STOOL_OUTBREAK ----------
{
  const p = getProfile("STOOL_OUTBREAK");
  assert(p.acceptance.mode === "qualified", "outbreak: qualified acceptance");
  assert(
    typeof p.acceptance.notes === "string" && p.acceptance.notes.toLowerCase().includes("outbreak"),
    "outbreak: notes mention outbreak",
  );
  assert(
    p.ipcFlagHints.includes("alert_organism_watch"),
    "outbreak: IPC alert organism watch hint",
  );
  assert(p.workbenchPanels.includes("stool_enteric_panel"), "outbreak: enteric panel");
  assert(p.syndrome === "infectious_diarrhoea", "outbreak: syndrome diarrhoea");
}

// ---------- RECTAL_SWAB_ENTERIC ----------
{
  const p = getProfile("RECTAL_SWAB_ENTERIC");
  assert(p.acceptance.mode === "qualified", "rectal swab: qualified acceptance");
  assert(
    p.acceptance.rejectionReasonCodes.includes("SWAB_DRY") &&
      p.acceptance.rejectionReasonCodes.includes("SWAB_NO_FAECAL_MATERIAL"),
    "rectal swab: swab-specific rejection codes",
  );
  assert(
    typeof p.acceptance.notes === "string" && p.acceptance.notes.toLowerCase().includes("suboptimal"),
    "rectal swab: notes flag suboptimal",
  );
  assert(p.workbenchPanels.includes("stool_enteric_panel"), "rectal swab: enteric panel");
  assert(p.syndrome === "infectious_diarrhoea", "rectal swab: syndrome diarrhoea");
}

// ---------- Unknown subtype guard ----------
{
  const result = resolveSpecimen("STOOL", "STOOL_DOES_NOT_EXIST");
  assert(!result.ok, "unknown stool subtype should not resolve");
}

// eslint-disable-next-line no-console
console.log("specimenResolverStool: all stool subtype assertions passed");
describe("stool specimen resolver assertion script", () => {
  it("passes stool subtype resolution checks", () => {});
});
