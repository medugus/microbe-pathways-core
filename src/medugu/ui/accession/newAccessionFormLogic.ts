import { getFamily } from "../../config/specimenFamilies";

export interface NewAccessionFormLogicInput {
  accessionNumber: string;
  accessionExists: boolean;
  familyCode: string;
  subtypeCode: string;
  isBlood: boolean;
  bloodSourcesCount: number;
  mode: "new" | "existing";
  existingMrn: string;
  givenName: string;
  familyName: string;
  mrn: string;
}

export function getFirstSubtypeForFamily(familyCode: string): string {
  return getFamily(familyCode)?.subtypes[0]?.code ?? "";
}

export function canSubmitNewAccessionForm(input: NewAccessionFormLogicInput): boolean {
  const {
    accessionNumber,
    accessionExists,
    familyCode,
    subtypeCode,
    isBlood,
    bloodSourcesCount,
    mode,
    existingMrn,
    givenName,
    familyName,
    mrn,
  } = input;

  return (
    accessionNumber.trim().length > 0 &&
    !accessionExists &&
    !!familyCode &&
    (isBlood ? bloodSourcesCount > 0 : !!subtypeCode) &&
    (mode === "existing"
      ? !!existingMrn
      : givenName.trim().length > 0 && familyName.trim().length > 0 && mrn.trim().length > 0)
  );
}

export function getNewAccessionSubmitBlockedReason(
  input: NewAccessionFormLogicInput,
): string | null {
  const mrnMissing = input.mode === "new" && input.mrn.trim().length === 0;
  const existingMrnMissing = input.mode === "existing" && input.existingMrn.trim().length === 0;
  const bloodSourceMissing = input.isBlood && input.bloodSourcesCount === 0;

  if (input.accessionExists) {
    return "Accession number already exists.";
  }
  if (mrnMissing || existingMrnMissing) {
    return "MRN / Identifier is required.";
  }
  if (bloodSourceMissing) {
    return "Select at least one blood-culture source.";
  }

  return null;
}
