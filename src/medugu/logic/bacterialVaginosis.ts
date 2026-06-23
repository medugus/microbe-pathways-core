export const BV_SCREEN_MICROSCOPY_CODE = "bacterialVaginosisScreen";
export const BV_SCREEN_DETAIL_KEY = "bacterialVaginosisScreen";

export type NugentInterpretation = "negative" | "intermediate" | "positive" | "incomplete";

export interface BacterialVaginosisScreenInput {
  /** Nugent morphotype score, 0-4: Lactobacillus morphotypes. */
  lactobacillusScore?: number;
  /** Nugent morphotype score, 0-4: Gardnerella/Bacteroides small Gram-variable rods. */
  gardnerellaBacteroidesScore?: number;
  /** Nugent morphotype score, 0-2: curved Gram-variable rods/Mobiluncus morphotypes. */
  mobiluncusScore?: number;
  /** Optional Amsel criterion: clue cells seen on wet mount/Gram film. */
  clueCells?: boolean;
  /** Optional Amsel criterion: vaginal pH. Positive criterion is pH > 4.5. */
  vaginalPh?: number;
  /** Optional Amsel criterion: amine/whiff test positive. */
  whiffTestPositive?: boolean;
  /** Optional Amsel criterion: thin homogeneous discharge. */
  homogeneousDischarge?: boolean;
}

export interface BacterialVaginosisScreenResult {
  nugentScore: number | null;
  nugentInterpretation: NugentInterpretation;
  nugentLabel: string;
  amselPositiveCriteria: number;
  amselRecordedCriteria: number;
  amselSupportive: boolean | null;
  summary: string;
  reportText: string;
}

const VAGINAL_BV_SUBTYPES = new Set(["GEN_HVS", "GEN_VULVOVAGINAL"]);

export function isBacterialVaginosisScreenSpecimen(
  familyCode?: string,
  subtypeCode?: string,
): boolean {
  return familyCode === "GENITAL" && !!subtypeCode && VAGINAL_BV_SUBTYPES.has(subtypeCode);
}

function scoreInRange(value: unknown, min: number, max: number): number | undefined {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  const rounded = Math.round(numeric);
  if (rounded < min || rounded > max) return undefined;
  return rounded;
}

export function normaliseBvScreenInput(value: unknown): BacterialVaginosisScreenInput {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const ph = Number(source.vaginalPh);

  return {
    lactobacillusScore: scoreInRange(source.lactobacillusScore, 0, 4),
    gardnerellaBacteroidesScore: scoreInRange(source.gardnerellaBacteroidesScore, 0, 4),
    mobiluncusScore: scoreInRange(source.mobiluncusScore, 0, 2),
    clueCells: typeof source.clueCells === "boolean" ? source.clueCells : undefined,
    vaginalPh: Number.isFinite(ph) ? ph : undefined,
    whiffTestPositive:
      typeof source.whiffTestPositive === "boolean" ? source.whiffTestPositive : undefined,
    homogeneousDischarge:
      typeof source.homogeneousDischarge === "boolean" ? source.homogeneousDischarge : undefined,
  };
}

export function evaluateBacterialVaginosisScreen(
  input: BacterialVaginosisScreenInput,
): BacterialVaginosisScreenResult {
  const hasCompleteNugent =
    input.lactobacillusScore !== undefined &&
    input.gardnerellaBacteroidesScore !== undefined &&
    input.mobiluncusScore !== undefined;
  const nugentScore = hasCompleteNugent
    ? input.lactobacillusScore! + input.gardnerellaBacteroidesScore! + input.mobiluncusScore!
    : null;
  const nugentInterpretation = interpretNugent(nugentScore);
  const amsel = countAmselCriteria(input);
  const nugentLabel = labelForNugent(nugentInterpretation);
  const scoreText = nugentScore === null ? "Nugent score incomplete" : `Nugent ${nugentScore}/10`;
  const amselText =
    amsel.recorded === 0
      ? "Amsel criteria not recorded"
      : `Amsel supportive criteria ${amsel.positive}/${amsel.recorded}${
          amsel.recorded < 4 ? " recorded" : ""
        }`;

  return {
    nugentScore,
    nugentInterpretation,
    nugentLabel,
    amselPositiveCriteria: amsel.positive,
    amselRecordedCriteria: amsel.recorded,
    amselSupportive: amsel.recorded === 4 ? amsel.positive >= 3 : null,
    summary: `${scoreText} - ${nugentLabel}. ${amselText}.`,
    reportText: `${scoreText} - ${nugentLabel}. ${amselText}. Culture of Gardnerella vaginalis alone is not used to diagnose BV.`,
  };
}

function interpretNugent(score: number | null): NugentInterpretation {
  if (score === null) return "incomplete";
  if (score <= 3) return "negative";
  if (score <= 6) return "intermediate";
  return "positive";
}

function labelForNugent(interpretation: NugentInterpretation): string {
  switch (interpretation) {
    case "negative":
      return "BV not supported; Lactobacillus-predominant flora";
    case "intermediate":
      return "intermediate vaginal flora";
    case "positive":
      return "bacterial vaginosis pattern detected";
    default:
      return "complete Nugent morphotype scores required";
  }
}

function countAmselCriteria(input: BacterialVaginosisScreenInput) {
  const criteria: Array<boolean | undefined> = [
    input.homogeneousDischarge,
    input.vaginalPh === undefined ? undefined : input.vaginalPh > 4.5,
    input.clueCells,
    input.whiffTestPositive,
  ];

  return criteria.reduce(
    (acc, value) => {
      if (value === undefined) return acc;
      return {
        recorded: acc.recorded + 1,
        positive: acc.positive + (value ? 1 : 0),
      };
    },
    { recorded: 0, positive: 0 },
  );
}
