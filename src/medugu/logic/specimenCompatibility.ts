// specimenCompatibility — pure helper for specimen/subtype to collection-method constraints.
// Keeps clinical compatibility mapping out of UI components.

const URINE_COLLECTION_METHODS_BY_SUBTYPE: Record<string, string[]> = {
  URINE_MIDSTREAM: ["MIDSTREAM_CLEAN_CATCH", "MIDSTREAM", "SELF_COLLECTED_CLEAN_CATCH"],
  URINE_CATHETER: [
    "CATHETER_SAMPLING_PORT",
    "NEWLY_INSERTED_CATHETER",
    "INTERMITTENT_CATHETERISATION",
    "INDWELLING_CATHETER",
  ],
  URINE_ILEAL_CONDUIT: [
    "CLEANED_STOMA_CONDUIT_COLLECTION",
    "CATHETERISED_CONDUIT_SPECIMEN",
    "FRESHLY_APPLIED_UROSTOMY_APPLIANCE",
  ],
  URINE_NEPHROSTOMY: ["NEPHROSTOMY_TUBE_SAMPLING", "FRESHLY_ACCESSED_NEPHROSTOMY_PORT"],
  URINE_SPA: ["SUPRAPUBIC_NEEDLE_ASPIRATE", "SPA"],
  URINE_IN_OUT: ["INTERMITTENT_CATHETERISATION", "IN_OUT_CATHETER"],
  URINE_OTHER: [
    "RANDOM_VOIDED",
    "CLEAN_CATCH",
    "PAEDIATRIC_URINE_BAG",
    "PAEDIATRIC_BAG",
    "FIRST_VOID",
    "FIRST_CATCH",
  ],
};

const DEFAULT_URINE_METHOD_BY_SUBTYPE: Record<string, string> = {
  URINE_MIDSTREAM: "MIDSTREAM_CLEAN_CATCH",
  URINE_CATHETER: "CATHETER_SAMPLING_PORT",
  URINE_ILEAL_CONDUIT: "CLEANED_STOMA_CONDUIT_COLLECTION",
  URINE_NEPHROSTOMY: "NEPHROSTOMY_TUBE_SAMPLING",
  URINE_SPA: "SUPRAPUBIC_NEEDLE_ASPIRATE",
  URINE_IN_OUT: "INTERMITTENT_CATHETERISATION",
  URINE_OTHER: "RANDOM_VOIDED",
};

export function getAllowedCollectionMethodsForSpecimen(
  specimenFamily?: string,
  specimenSubtype?: string,
): string[] | null {
  if (specimenFamily !== "URINE" || !specimenSubtype) return null;
  return URINE_COLLECTION_METHODS_BY_SUBTYPE[specimenSubtype] ?? null;
}

export function isCollectionMethodCompatibleWithSpecimen(
  specimenFamily?: string,
  specimenSubtype?: string,
  collectionMethod?: string,
): boolean {
  if (!collectionMethod) return true;
  const allowed = getAllowedCollectionMethodsForSpecimen(specimenFamily, specimenSubtype);
  if (!allowed) return true;
  return allowed.includes(collectionMethod);
}

export function getDefaultCollectionMethodForSpecimen(
  specimenFamily?: string,
  specimenSubtype?: string,
): string | null {
  if (specimenFamily !== "URINE" || !specimenSubtype) return null;
  return DEFAULT_URINE_METHOD_BY_SUBTYPE[specimenSubtype] ?? null;
}

export function getCollectionMethodGuidanceForSpecimen(
  specimenFamily?: string,
  specimenSubtype?: string,
): string | null {
  if (specimenFamily !== "URINE") return null;
  if (specimenSubtype === "URINE_ILEAL_CONDUIT") {
    return "Ileal conduit urine is not a midstream specimen. Collect from a cleaned stoma/conduit or by catheterising the conduit according to local protocol.";
  }
  if (specimenSubtype === "URINE_OTHER") {
    return "Paediatric bag urine carries a higher contamination risk and is not preferred for culture confirmation.";
  }
  return null;
}
