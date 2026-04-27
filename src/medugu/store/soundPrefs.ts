// Browser-phase sound preferences.
// localStorage-backed only — no server sync, no cross-device propagation.
// Two alert classes: "critical" and "urgent". Volume + repeat are user-controlled.

export interface SoundPrefs {
  enabled: boolean;
  volume: number; // 0..1
  repeatCritical: boolean; // re-play unacknowledged critical at interval
  repeatIntervalSec: number;
}

export const DEFAULT_SOUND_PREFS: SoundPrefs = {
  enabled: true,
  volume: 0.4,
  repeatCritical: true,
  repeatIntervalSec: 20,
};

const KEY = "medugu.soundPrefs.v1";

export function loadSoundPrefs(): SoundPrefs {
  if (typeof window === "undefined") return DEFAULT_SOUND_PREFS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SOUND_PREFS;
    const parsed = JSON.parse(raw) as Partial<SoundPrefs>;
    return {
      ...DEFAULT_SOUND_PREFS,
      ...parsed,
      volume: clamp(parsed.volume ?? DEFAULT_SOUND_PREFS.volume, 0, 1),
      repeatIntervalSec: Math.max(
        5,
        parsed.repeatIntervalSec ?? DEFAULT_SOUND_PREFS.repeatIntervalSec,
      ),
    };
  } catch {
    return DEFAULT_SOUND_PREFS;
  }
}

export function saveSoundPrefs(p: SoundPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore quota errors */
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
