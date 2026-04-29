// EUCAST v16.0 Enterobacterales — indication-aware resolveBreakpoint tests.
// Plain assert-style, matching the project's other __tests__ files.

import {
  resolveBreakpoint,
  findDuplicateBreakpointKeys,
  syndromeToIndicationChain,
} from "../../config/breakpoints";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(`EUCAST 2026 Enterobacterales: ${message}`);
}

// 1. Registry uniqueness
const dups = findDuplicateBreakpointKeys();
assert(dups.length === 0, `Duplicate composite keys found: ${dups.join(", ")}`);

// 2. E. coli + UTI → AMC oral UTI breakpoint
{
  const r = resolveBreakpoint({
    organismGroup: "enterobacterales", organismCode: "ECOL",
    antibioticCode: "AMC", method: "MIC", standard: "EUCAST", syndrome: "uti",
  });
  assert(r.status === "matched", "AMC ECOL UTI must match");
  assert(r.indicationUsed === "uti", `AMC ECOL UTI indication must be uti, got ${r.indicationUsed}`);
  assert(r.breakpointKey === "enterobacterales|AMC|mic|uti", `AMC key wrong: ${r.breakpointKey}`);
}

// 3. Klebsiella BSI → MEM non-meningitis (S≤2 / R>8)
{
  const r = resolveBreakpoint({
    organismGroup: "enterobacterales", organismCode: "KPNE",
    antibioticCode: "MEM", method: "MIC", standard: "EUCAST", syndrome: "bsi",
  });
  assert(r.status === "matched" && r.indicationUsed === "non_meningitis", "MEM BSI non-meningitis");
  const bp = r.breakpoint as { susceptibleMaxMgL?: number };
  assert(bp.susceptibleMaxMgL === 2, "MEM non-meningitis MIC S≤2");
}

// 4. CSF / meningitis → MEM meningitis (S≤2 / R>2)
{
  const r = resolveBreakpoint({
    organismGroup: "enterobacterales", organismCode: "ECOL",
    antibioticCode: "MEM", method: "MIC", standard: "EUCAST", syndrome: "meningitis",
  });
  assert(r.indicationUsed === "meningitis", "MEM CSF meningitis");
  assert(r.flags.meningitisOnly === true, "MEM meningitis flag");
}

// 5. Non–E. coli + Nitrofurantoin → species_restricted_block
{
  const r = resolveBreakpoint({
    organismGroup: "enterobacterales", organismCode: "KPNE",
    antibioticCode: "NIT", method: "MIC", standard: "EUCAST", syndrome: "uti",
  });
  assert(r.status === "species_restricted_block", "NIT non-Ecoli must block");
}

// 6. E. coli + NIT → matched
{
  const r = resolveBreakpoint({
    organismGroup: "enterobacterales", organismCode: "ECOL",
    antibioticCode: "NIT", method: "MIC", standard: "EUCAST", syndrome: "uti_uncomplicated",
  });
  assert(r.status === "matched", "NIT ECOL must match");
}

// 7. GEN syndrome switch
{
  const sys = resolveBreakpoint({
    organismGroup: "enterobacterales", organismCode: "ECOL",
    antibioticCode: "GEN", method: "MIC", standard: "EUCAST", syndrome: "bsi",
  });
  assert(sys.indicationUsed === "non_meningitis" || sys.indicationUsed === "systemic",
    `GEN BSI should resolve to systemic or non_meningitis, got ${sys.indicationUsed}`);
  // EUCAST GEN BSI primary path: chain is non_meningitis,systemic,iv,general → systemic exists
  // (no non_meningitis row for GEN), so we expect systemic.
  assert(sys.indicationUsed === "systemic", `GEN BSI must pick systemic, got ${sys.indicationUsed}`);
  assert(sys.flags.bracketed === true, "GEN systemic bracketed");

  const uti = resolveBreakpoint({
    organismGroup: "enterobacterales", organismCode: "ECOL",
    antibioticCode: "GEN", method: "MIC", standard: "EUCAST", syndrome: "uti",
  });
  assert(uti.indicationUsed === "uti", "GEN UTI indication");
  assert(!uti.flags.bracketed, "GEN UTI not bracketed");
}

// 8. CRO meningitis vs non-meningitis split
{
  const m = resolveBreakpoint({
    organismGroup: "enterobacterales", organismCode: "ECOL",
    antibioticCode: "CRO", method: "MIC", standard: "EUCAST", syndrome: "meningitis",
  });
  const mb = m.breakpoint as { resistantGreaterThanMgL?: number };
  assert(mb.resistantGreaterThanMgL === 1, "CRO meningitis R>1");

  const nm = resolveBreakpoint({
    organismGroup: "enterobacterales", organismCode: "ECOL",
    antibioticCode: "CRO", method: "MIC", standard: "EUCAST", syndrome: "bsi",
  });
  const nmb = nm.breakpoint as { resistantGreaterThanMgL?: number };
  assert(nmb.resistantGreaterThanMgL === 2, "CRO non-meningitis R>2");
}

// 9. Serratia case is not present in the registry: when organismGroup is
// enterobacterales and SXT is queried, the general row applies (Serratia
// override is documented but intentionally not auto-applied without a
// per-genus group; this is the safest behaviour pending a Serratia group).
{
  const r = resolveBreakpoint({
    organismGroup: "enterobacterales", organismCode: "ECOL",
    antibioticCode: "SXT", method: "MIC", standard: "EUCAST", syndrome: "uti",
  });
  assert(r.status === "matched", "SXT must match general");
}

// 10. syndromeToIndicationChain order
assert(syndromeToIndicationChain("meningitis")[0] === "meningitis", "meningitis chain head");
assert(syndromeToIndicationChain("uti")[0] === "uti", "uti chain head");

// eslint-disable-next-line no-console
console.log("EUCAST 2026 Enterobacterales tests passed.");
export {};
