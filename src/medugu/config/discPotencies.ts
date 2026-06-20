export interface DiscPotencyDef {
  antibioticCode: string;
  potency: string;
  note?: string;
}

export const DISC_POTENCIES: DiscPotencyDef[] = [
  { antibioticCode: "AMP", potency: "10 ug" },
  { antibioticCode: "AMX", potency: "10 ug" },
  { antibioticCode: "AMC", potency: "20/10 ug" },
  { antibioticCode: "TZP", potency: "30/6 ug" },
  { antibioticCode: "PEN", potency: "1 unit" },
  { antibioticCode: "CXM", potency: "30 ug" },
  { antibioticCode: "CRO", potency: "30 ug" },
  { antibioticCode: "CTX", potency: "5 ug" },
  { antibioticCode: "CAZ", potency: "10 ug" },
  { antibioticCode: "FEP", potency: "30 ug" },
  { antibioticCode: "CFM", potency: "5 ug" },
  { antibioticCode: "ATM", potency: "30 ug" },
  { antibioticCode: "ETP", potency: "10 ug" },
  { antibioticCode: "MEM", potency: "10 ug" },
  { antibioticCode: "IPM", potency: "10 ug" },
  { antibioticCode: "DOR", potency: "10 ug" },
  { antibioticCode: "AMK", potency: "30 ug" },
  { antibioticCode: "GEN", potency: "10 ug" },
  { antibioticCode: "TOB", potency: "10 ug" },
  { antibioticCode: "CIP", potency: "5 ug" },
  { antibioticCode: "LVX", potency: "5 ug" },
  { antibioticCode: "MXF", potency: "5 ug" },
  { antibioticCode: "SXT", potency: "1.25/23.75 ug" },
  { antibioticCode: "TGC", potency: "15 ug" },
  { antibioticCode: "TET", potency: "30 ug" },
  { antibioticCode: "DOX", potency: "30 ug" },
  { antibioticCode: "NIT", potency: "100 ug" },
  { antibioticCode: "FOS", potency: "200 ug" },
  { antibioticCode: "FOX", potency: "30 ug" },
  { antibioticCode: "OXA", potency: "1 ug" },
  { antibioticCode: "VAN", potency: "5 ug" },
  { antibioticCode: "TEC", potency: "30 ug" },
  { antibioticCode: "LZD", potency: "10 ug" },
  { antibioticCode: "CLI", potency: "2 ug" },
  { antibioticCode: "ERY", potency: "15 ug" },
  { antibioticCode: "CHL", potency: "30 ug" },
  { antibioticCode: "RIF", potency: "5 ug" },
];

const DISC_POTENCY_BY_CODE = new Map(
  DISC_POTENCIES.map((entry) => [entry.antibioticCode, entry] as const),
);

export function getDiscPotency(antibioticCode: string): string | undefined {
  return DISC_POTENCY_BY_CODE.get(antibioticCode.toUpperCase())?.potency;
}
