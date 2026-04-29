// EUCAST v16.0 Enterobacterales — indication-aware resolveBreakpoint tests.
import { describe, expect, it } from "vitest";
import {
  resolveBreakpoint,
  findDuplicateBreakpointKeys,
  syndromeToIndicationChain,
} from "../../config/breakpoints";

describe("EUCAST 2026 Enterobacterales — composite-key resolution", () => {
  it("registry has no duplicate composite keys (org|drug|method|indication)", () => {
    expect(findDuplicateBreakpointKeys()).toEqual([]);
  });

  it("E. coli + UTI → AMC oral UTI breakpoint selected (S≤0.001 / R>8 MIC)", () => {
    const r = resolveBreakpoint({
      organismGroup: "enterobacterales",
      organismCode: "ECOL",
      antibioticCode: "AMC",
      method: "MIC",
      standard: "EUCAST",
      syndrome: "uti",
    });
    expect(r.status).toBe("matched");
    expect(r.indicationUsed).toBe("uti");
    expect(r.breakpointKey).toBe("enterobacterales|AMC|mic|uti");
  });

  it("Klebsiella BSI → MEM non-meningitis applied (S≤2 / R>8)", () => {
    const r = resolveBreakpoint({
      organismGroup: "enterobacterales",
      organismCode: "KPNE",
      antibioticCode: "MEM",
      method: "MIC",
      standard: "EUCAST",
      syndrome: "bsi",
    });
    expect(r.status).toBe("matched");
    expect(r.indicationUsed).toBe("non_meningitis");
    expect(r.breakpoint?.method).toBe("mic");
    // @ts-expect-error MIC fields
    expect(r.breakpoint?.susceptibleMaxMgL).toBe(2);
  });

  it("CSF / meningitis → MEM meningitis breakpoint applied (S≤2 / R>2)", () => {
    const r = resolveBreakpoint({
      organismGroup: "enterobacterales",
      organismCode: "ECOL",
      antibioticCode: "MEM",
      method: "MIC",
      standard: "EUCAST",
      syndrome: "meningitis",
    });
    expect(r.status).toBe("matched");
    expect(r.indicationUsed).toBe("meningitis");
    expect(r.flags.meningitisOnly).toBe(true);
  });

  it("Non–E. coli + Nitrofurantoin → species_restricted_block", () => {
    const r = resolveBreakpoint({
      organismGroup: "enterobacterales",
      organismCode: "KPNE",
      antibioticCode: "NIT",
      method: "MIC",
      standard: "EUCAST",
      syndrome: "uti",
    });
    expect(r.status).toBe("species_restricted_block");
    expect(r.flags.restrictedSpecies).toEqual(["ECOL"]);
  });

  it("E. coli + Nitrofurantoin UTI → matched (E. coli only)", () => {
    const r = resolveBreakpoint({
      organismGroup: "enterobacterales",
      organismCode: "ECOL",
      antibioticCode: "NIT",
      method: "MIC",
      standard: "EUCAST",
      syndrome: "uti_uncomplicated",
    });
    expect(r.status).toBe("matched");
    expect(r.flags.restrictedSpecies).toEqual(["ECOL"]);
  });

  it("GEN syndrome switch: BSI → systemic (bracketed); UTI → urinary", () => {
    const sys = resolveBreakpoint({
      organismGroup: "enterobacterales",
      organismCode: "ECOL",
      antibioticCode: "GEN",
      method: "MIC",
      standard: "EUCAST",
      syndrome: "bsi",
    });
    expect(sys.indicationUsed).toBe("systemic");
    expect(sys.flags.bracketed).toBe(true);

    const uti = resolveBreakpoint({
      organismGroup: "enterobacterales",
      organismCode: "ECOL",
      antibioticCode: "GEN",
      method: "MIC",
      standard: "EUCAST",
      syndrome: "uti",
    });
    expect(uti.indicationUsed).toBe("uti");
    expect(uti.flags.bracketed).toBeFalsy();
  });

  it("CIP meningitis disk → MIC-only / screening_only flag (no native disk row at meningitis)", () => {
    // Disk lookup at meningitis falls back through chain → general → uses non_meningitis
    const disk = resolveBreakpoint({
      organismGroup: "enterobacterales",
      organismCode: "ECOL",
      antibioticCode: "CIP",
      method: "disk_diffusion",
      standard: "EUCAST",
      syndrome: "meningitis",
    });
    // No meningitis-specific disk row; falls back to non_meningitis.
    expect(disk.status).toBe("matched");
    expect(disk.indicationUsed).toBe("non_meningitis");

    const mic = resolveBreakpoint({
      organismGroup: "enterobacterales",
      organismCode: "ECOL",
      antibioticCode: "CIP",
      method: "MIC",
      standard: "EUCAST",
      syndrome: "meningitis",
    });
    expect(mic.indicationUsed).toBe("meningitis");
    expect(mic.flags.screeningOnly).toBe(true);
  });

  it("syndromeToIndicationChain prioritises meningitis when syndrome is meningitis", () => {
    expect(syndromeToIndicationChain("meningitis")[0]).toBe("meningitis");
  });

  it("CRO meningitis vs non-meningitis split (MIC R>1 vs R>2)", () => {
    const m = resolveBreakpoint({
      organismGroup: "enterobacterales",
      organismCode: "ECOL",
      antibioticCode: "CRO",
      method: "MIC",
      standard: "EUCAST",
      syndrome: "meningitis",
    });
    // @ts-expect-error MIC fields
    expect(m.breakpoint?.resistantGreaterThanMgL).toBe(1);

    const nm = resolveBreakpoint({
      organismGroup: "enterobacterales",
      organismCode: "ECOL",
      antibioticCode: "CRO",
      method: "MIC",
      standard: "EUCAST",
      syndrome: "bsi",
    });
    // @ts-expect-error MIC fields
    expect(nm.breakpoint?.resistantGreaterThanMgL).toBe(2);
  });
});
