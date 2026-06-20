import { ANTIBIOTICS, getAntibiotic } from "../config/antibiotics";
import { getOrganism } from "../config/organisms";
import type { Accession, ASTResult, Isolate, MeduguState } from "../domain/types";

export interface AntibiogramFilters {
  fromDate?: string;
  toDate?: string;
  specimenFamily?: string;
  organismGroup?: string;
  minCount?: number;
  includeDraft?: boolean;
}

export interface AntibiogramCell {
  antibioticCode: string;
  antibioticName: string;
  susceptible: number;
  increasedExposure: number;
  resistant: number;
  total: number;
  susceptiblePercent: number;
  lowCount: boolean;
}

export interface AntibiogramOrganismRow {
  organismCode: string;
  organismName: string;
  organismGroup: string;
  patientCount: number;
  isolateCount: number;
  testedDrugCount: number;
  cells: Record<string, AntibiogramCell>;
}

export interface LiveAntibiogram {
  generatedAt: string;
  filters: Required<Pick<AntibiogramFilters, "minCount" | "includeDraft">> & AntibiogramFilters;
  accessionsInScope: number;
  astRowsInScope: number;
  organismRows: AntibiogramOrganismRow[];
  antibioticCodes: string[];
  lowCountCellCount: number;
}

interface DedupedEntry {
  accession: Accession;
  isolate: Isolate;
  ast: ASTResult;
  dateKey: string;
  interpretation: "S" | "I" | "R";
}

const DEFAULT_MIN_COUNT = 30;
const STANDARD_INTERPRETATIONS = new Set(["S", "I", "R"]);

function accessionDate(accession: Accession): string {
  return accession.specimen.collectedAt ?? accession.createdAt;
}

function dateInRange(dateIso: string, fromDate?: string, toDate?: string): boolean {
  const date = dateIso.slice(0, 10);
  if (fromDate && date < fromDate) return false;
  if (toDate && date > toDate) return false;
  return true;
}

function finalSir(row: ASTResult): "S" | "I" | "R" | null {
  const value = row.finalInterpretation ?? row.interpretedSIR ?? row.rawInterpretation;
  return STANDARD_INTERPRETATIONS.has(value ?? "") ? (value as "S" | "I" | "R") : null;
}

function includeAstRow(row: ASTResult, includeDraft: boolean): boolean {
  if (includeDraft) return true;
  return row.governance === "approved" || row.governance === "released";
}

function patientKey(accession: Accession): string {
  return accession.patient.mrn.trim() || accession.patient.encounterId?.trim() || accession.id;
}

function dedupeKey(accession: Accession, isolate: Isolate, row: ASTResult): string {
  return [
    patientKey(accession),
    isolate.organismCode || isolate.organismDisplay,
    row.antibioticCode,
  ].join("|");
}

function sortAntibioticCodes(codes: Iterable<string>): string[] {
  const order = new Map(ANTIBIOTICS.map((antibiotic, index) => [antibiotic.code, index]));
  return Array.from(codes).sort((a, b) => {
    const ao = order.get(a) ?? Number.MAX_SAFE_INTEGER;
    const bo = order.get(b) ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return a.localeCompare(b);
  });
}

export function computeLiveAntibiogram(
  state: MeduguState,
  inputFilters: AntibiogramFilters = {},
  now = new Date(),
): LiveAntibiogram {
  const filters = {
    ...inputFilters,
    minCount: inputFilters.minCount ?? DEFAULT_MIN_COUNT,
    includeDraft: inputFilters.includeDraft ?? true,
  };
  const deduped = new Map<string, DedupedEntry>();
  let accessionsInScope = 0;
  let astRowsInScope = 0;

  for (const accessionId of state.accessionOrder) {
    const accession = state.accessions[accessionId];
    if (!accession) continue;
    if (filters.specimenFamily && filters.specimenFamily !== "all" && accession.specimen.familyCode !== filters.specimenFamily) {
      continue;
    }
    const dateKey = accessionDate(accession);
    if (!dateInRange(dateKey, filters.fromDate, filters.toDate)) continue;

    const isolatesById = new Map(accession.isolates.map((isolate) => [isolate.id, isolate]));
    let countedAccession = false;
    for (const row of accession.ast) {
      if (!includeAstRow(row, filters.includeDraft)) continue;
      const interpretation = finalSir(row);
      if (!interpretation) continue;
      const isolate = isolatesById.get(row.isolateId);
      if (!isolate) continue;
      const organism = getOrganism(isolate.organismCode);
      if (organism?.noAst) continue;
      const group = organism?.group ?? "other";
      if (filters.organismGroup && filters.organismGroup !== "all" && group !== filters.organismGroup) {
        continue;
      }

      countedAccession = true;
      astRowsInScope += 1;
      const key = dedupeKey(accession, isolate, row);
      const existing = deduped.get(key);
      if (!existing || dateKey < existing.dateKey) {
        deduped.set(key, { accession, isolate, ast: row, dateKey, interpretation });
      }
    }
    if (countedAccession) accessionsInScope += 1;
  }

  const rowMap = new Map<string, AntibiogramOrganismRow>();
  const patientSets = new Map<string, Set<string>>();
  const isolateSets = new Map<string, Set<string>>();
  const antibioticCodes = new Set<string>();

  for (const entry of deduped.values()) {
    const organism = getOrganism(entry.isolate.organismCode);
    const organismCode = entry.isolate.organismCode || entry.isolate.organismDisplay;
    const rowKey = organismCode;
    const group = organism?.group ?? "other";
    const current =
      rowMap.get(rowKey) ??
      {
        organismCode,
        organismName: organism?.display ?? entry.isolate.organismDisplay,
        organismGroup: group,
        patientCount: 0,
        isolateCount: 0,
        testedDrugCount: 0,
        cells: {},
      };

    const antibiotic = getAntibiotic(entry.ast.antibioticCode);
    const antibioticCode = entry.ast.antibioticCode;
    const cell =
      current.cells[antibioticCode] ??
      {
        antibioticCode,
        antibioticName: antibiotic?.display ?? antibioticCode,
        susceptible: 0,
        increasedExposure: 0,
        resistant: 0,
        total: 0,
        susceptiblePercent: 0,
        lowCount: true,
      };

    if (entry.interpretation === "S") cell.susceptible += 1;
    if (entry.interpretation === "I") cell.increasedExposure += 1;
    if (entry.interpretation === "R") cell.resistant += 1;
    cell.total += 1;
    cell.susceptiblePercent = Math.round((cell.susceptible / cell.total) * 1000) / 10;
    cell.lowCount = cell.total < filters.minCount;

    current.cells[antibioticCode] = cell;
    rowMap.set(rowKey, current);
    antibioticCodes.add(antibioticCode);

    const patientSet = patientSets.get(rowKey) ?? new Set<string>();
    patientSet.add(patientKey(entry.accession));
    patientSets.set(rowKey, patientSet);

    const isolateSet = isolateSets.get(rowKey) ?? new Set<string>();
    isolateSet.add(`${entry.accession.id}|${entry.isolate.id}`);
    isolateSets.set(rowKey, isolateSet);
  }

  const organismRows = Array.from(rowMap.values())
    .map((row) => ({
      ...row,
      patientCount: patientSets.get(row.organismCode)?.size ?? 0,
      isolateCount: isolateSets.get(row.organismCode)?.size ?? 0,
      testedDrugCount: Object.keys(row.cells).length,
    }))
    .sort((a, b) => b.patientCount - a.patientCount || a.organismName.localeCompare(b.organismName));

  let lowCountCellCount = 0;
  for (const row of organismRows) {
    for (const cell of Object.values(row.cells)) {
      if (cell.lowCount) lowCountCellCount += 1;
    }
  }

  return {
    generatedAt: now.toISOString(),
    filters,
    accessionsInScope,
    astRowsInScope,
    organismRows,
    antibioticCodes: sortAntibioticCodes(antibioticCodes),
    lowCountCellCount,
  };
}
