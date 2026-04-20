// SoundTriggerGate — observes Medugu state and emits sound events ONLY on
// new transitions, never on every render. Mounted once near the app shell.
//
// What it watches per accession:
//   - validation blockers: PHONE_OUT_REQUIRED, SEAL_MISMATCH (critical),
//     CONSULTANT_APPROVAL_REQUIRED (urgent)
//   - IPC decisions: new high-priority rule codes (urgent)
//
// What it intentionally does NOT do:
//   - Play on routine warnings (missing microscopy, AMS pending, draft AST)
//   - Mutate workflow state
//   - Replace any visible chip / banner / status text

import { useEffect, useRef } from "react";
import { useMeduguState } from "../store/useAccessionStore";
import { runValidation } from "../logic/validationEngine";
import { evaluateIPC } from "../logic/ipcEngine";
import {
  CRITICAL_VALIDATION_CODES,
  HIGH_PRIORITY_IPC_CODES,
  URGENT_VALIDATION_CODES,
  soundEngine,
} from "../logic/soundEngine";

export function SoundTriggerGate() {
  const state = useMeduguState();
  // Track the codes/rules we have already announced per accession, so we only
  // fire on the transition (absent → present), not on every store update.
  const seenValidation = useRef<Map<string, Set<string>>>(new Map());
  const seenIpc = useRef<Map<string, Set<string>>>(new Map());

  useEffect(() => {
    for (const a of Object.values(state.accessions)) {
      // Validation transitions
      const v = runValidation(a);
      const presentCodes = new Set(v.blockers.map((b) => b.code));
      const prevCodes = seenValidation.current.get(a.id) ?? new Set<string>();

      for (const code of presentCodes) {
        if (prevCodes.has(code)) continue;
        if (CRITICAL_VALIDATION_CODES.has(code)) {
          soundEngine.emit({
            cls: "critical",
            key: `${a.id}:val:${code}`,
            label: `${a.accessionNumber} · ${code}`,
          });
        } else if (URGENT_VALIDATION_CODES.has(code)) {
          soundEngine.emit({
            cls: "urgent",
            key: `${a.id}:val:${code}`,
            label: `${a.accessionNumber} · ${code}`,
          });
        }
      }
      // Resolve cleared critical keys (so the repeat loop stops automatically).
      for (const code of prevCodes) {
        if (!presentCodes.has(code) && CRITICAL_VALIDATION_CODES.has(code)) {
          soundEngine.resolve(`${a.id}:val:${code}`);
        }
      }
      seenValidation.current.set(a.id, presentCodes);

      // IPC transitions — urgent only, on new high-priority rule codes.
      const ipc = evaluateIPC(a, state.accessions);
      const presentIpc = new Set<string>();
      for (const d of ipc.decisions) {
        if (!d.isNewEpisode) continue;
        if (!HIGH_PRIORITY_IPC_CODES.has(d.ruleCode)) continue;
        presentIpc.add(d.ruleCode);
      }
      const prevIpc = seenIpc.current.get(a.id) ?? new Set<string>();
      for (const code of presentIpc) {
        if (prevIpc.has(code)) continue;
        soundEngine.emit({
          cls: "urgent",
          key: `${a.id}:ipc:${code}`,
          label: `${a.accessionNumber} · IPC ${code}`,
        });
      }
      seenIpc.current.set(a.id, presentIpc);
    }
  }, [state]);

  return null;
}
