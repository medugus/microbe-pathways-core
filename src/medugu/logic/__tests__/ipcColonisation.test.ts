import { ipcAcceptanceScenarioCases, toAccessionsMap } from "../../fixtures/ipcAcceptanceCases";
import { deriveColonisationContext } from "../ipcColonisation";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const fixedNow = Date.parse("2026-04-25T12:00:00.000Z");
const originalDateNow = Date.now;
Date.now = () => fixedNow;

const candida = deriveColonisationContext(
  ipcAcceptanceScenarioCases.candidaAurisScreenPositiveCase,
  toAccessionsMap([ipcAcceptanceScenarioCases.candidaAurisScreenPositiveCase]),
);
assert(candida.isScreen, "Candida auris screen should be recognised as colonisation screen.");
assert(candida.screenResult === "positive", "Candida auris screen should be positive.");

const diagnostic = deriveColonisationContext(
  ipcAcceptanceScenarioCases.mrsaBloodstreamCase,
  toAccessionsMap([ipcAcceptanceScenarioCases.mrsaBloodstreamCase]),
);
assert(
  !diagnostic.isScreen,
  "Diagnostic blood culture should not be treated as colonisation screen.",
);

const clearanceMap = toAccessionsMap(ipcAcceptanceScenarioCases.creClearanceSeries);
const clearanceContext = deriveColonisationContext(
  ipcAcceptanceScenarioCases.creClearanceSeries[1],
  clearanceMap,
);
assert(
  clearanceContext.episodeStatus === "clearance_attempt",
  "Negative follow-up after prior positive should be clearance_attempt.",
);
assert(
  clearanceContext.clearanceCount === 1,
  "Clearance counter should use currently loaded cases and count one negative.",
);
assert(
  clearanceContext.limitationNote?.includes("currently loaded") ?? false,
  "Clearance context should include browser-local/currently loaded limitation wording.",
);

const missingPrior = deriveColonisationContext(
  ipcAcceptanceScenarioCases.creClearanceSeries[1],
  toAccessionsMap([ipcAcceptanceScenarioCases.creClearanceSeries[1]]),
);
assert(
  missingPrior.clearanceCount === 0,
  "Without prior positive in loaded data, clearance count should safely be 0.",
);
assert(
  missingPrior.limitationNote?.includes("prior positive not found") ?? false,
  "Missing prior positive should include safe limitation wording.",
);

Date.now = originalDateNow;

// eslint-disable-next-line no-console
console.log("[ipcColonisation.test] all assertions passed");
