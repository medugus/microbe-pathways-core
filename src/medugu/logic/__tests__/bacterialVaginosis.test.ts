import { describe, expect, it } from "vitest";
import {
  evaluateBacterialVaginosisScreen,
  isBacterialVaginosisScreenSpecimen,
  normaliseBvScreenInput,
} from "../bacterialVaginosis";

describe("bacterial vaginosis screen", () => {
  it("restricts BV screening to vaginal genital specimens", () => {
    expect(isBacterialVaginosisScreenSpecimen("GENITAL", "GEN_HVS")).toBe(true);
    expect(isBacterialVaginosisScreenSpecimen("GENITAL", "GEN_VULVOVAGINAL")).toBe(true);
    expect(isBacterialVaginosisScreenSpecimen("GENITAL", "GEN_URETHRAL")).toBe(false);
    expect(isBacterialVaginosisScreenSpecimen("URINE", "URINE_MIDSTREAM")).toBe(false);
  });

  it("classifies Nugent scores using standard BV bands", () => {
    const negative = evaluateBacterialVaginosisScreen({
      lactobacillusScore: 0,
      gardnerellaBacteroidesScore: 1,
      mobiluncusScore: 0,
    });
    const intermediate = evaluateBacterialVaginosisScreen({
      lactobacillusScore: 2,
      gardnerellaBacteroidesScore: 3,
      mobiluncusScore: 1,
    });
    const positive = evaluateBacterialVaginosisScreen({
      lactobacillusScore: 4,
      gardnerellaBacteroidesScore: 4,
      mobiluncusScore: 2,
      clueCells: true,
      vaginalPh: 5.2,
      whiffTestPositive: true,
      homogeneousDischarge: true,
    });

    expect(negative.nugentScore).toBe(1);
    expect(negative.nugentInterpretation).toBe("negative");
    expect(intermediate.nugentScore).toBe(6);
    expect(intermediate.nugentInterpretation).toBe("intermediate");
    expect(positive.nugentScore).toBe(10);
    expect(positive.nugentInterpretation).toBe("positive");
    expect(positive.amselSupportive).toBe(true);
  });

  it("normalises stored detail values before scoring", () => {
    const result = evaluateBacterialVaginosisScreen(
      normaliseBvScreenInput({
        lactobacillusScore: "4",
        gardnerellaBacteroidesScore: "2",
        mobiluncusScore: "1",
        clueCells: true,
        vaginalPh: "4.7",
      }),
    );

    expect(result.nugentScore).toBe(7);
    expect(result.nugentInterpretation).toBe("positive");
    expect(result.amselPositiveCriteria).toBe(2);
    expect(result.amselRecordedCriteria).toBe(2);
  });
});
