// React binding for accessionStore. Only file in store/ that touches React.

import { useSyncExternalStore } from "react";
import { accessionStore } from "./accessionStore";
import type { Accession, MeduguState } from "../domain/types";

export function useMeduguState(): MeduguState {
  return useSyncExternalStore(
    accessionStore.subscribe,
    accessionStore.getState,
    accessionStore.getState,
  );
}

export function useActiveAccession(): Accession | null {
  const s = useMeduguState();
  return s.activeAccessionId ? (s.accessions[s.activeAccessionId] ?? null) : null;
}

export const meduguActions = {
  setActive: accessionStore.setActive,
  upsertAccession: accessionStore.upsertAccession,
  removeAccession: accessionStore.removeAccession,
  resetToSeed: accessionStore.resetToSeed,
  hydrateFromTenant: accessionStore.hydrateFromTenant,
  detachTenant: accessionStore.detachTenant,
  addIsolate: accessionStore.addIsolate,
  updateIsolate: accessionStore.updateIsolate,
  removeIsolate: accessionStore.removeIsolate,
  addAST: accessionStore.addAST,
  updateAST: accessionStore.updateAST,
  removeAST: accessionStore.removeAST,
  overrideCascade: accessionStore.overrideCascade,
  setWorkflowStage: accessionStore.setWorkflowStage,
  recordPhoneOut: accessionStore.recordPhoneOut,
  finaliseRelease: accessionStore.finaliseRelease,
  recordConsultantApproval: accessionStore.recordConsultantApproval,
  applyExpertRules: accessionStore.applyExpertRules,
  recordConsultantOverride: accessionStore.recordConsultantOverride,
  requestAMSApproval: accessionStore.requestAMSApproval,
  decideAMSApproval: accessionStore.decideAMSApproval,
  expireAMSApproval: accessionStore.expireAMSApproval,
  escalateAMSApproval: accessionStore.escalateAMSApproval,
};
