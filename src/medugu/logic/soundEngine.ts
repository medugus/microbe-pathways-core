// Browser-phase sound engine for clinical alerts.
//
// Scope:
//   - Two alert classes only: "critical" and "urgent".
//   - Sounds are synthesized via WebAudio (no asset files, no autoplay on load).
//   - Triggered ONLY from explicit emit() calls, which the trigger gate fires
//     on observed state transitions — never on render.
//   - Repeating critical alerts loop at a user-controlled interval until
//     acknowledged via acknowledge(). No alarm-loop on rerender.
//
// This is an alert affordance, not a notification engine. It does not replace
// any visible chip, banner, or text state; the UI must continue to convey the
// same information without sound.

import { loadSoundPrefs, type SoundPrefs } from "../store/soundPrefs";

export type SoundClass = "critical" | "urgent";

export interface SoundEvent {
  cls: SoundClass;
  /** Stable key identifying the source transition (used for repeat tracking). */
  key: string;
  /** Optional human label for debugging / settings preview. */
  label?: string;
}

type Listener = (active: ActiveAlertSummary) => void;

export interface ActiveAlertSummary {
  /** Number of unacknowledged critical events currently repeating. */
  pendingCritical: number;
  /** Most recent critical key, or null if none pending. */
  lastCriticalKey: string | null;
}

let prefs: SoundPrefs = loadSoundPrefs();
let audioCtx: AudioContext | null = null;
const pendingCritical = new Map<string, { label?: string; since: number }>();
let repeatTimer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<Listener>();

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioCtx) return audioCtx;
  const Ctor =
    (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    audioCtx = new Ctor();
  } catch {
    audioCtx = null;
  }
  return audioCtx;
}

/** Play a short, distinct tone for a class. Pure WebAudio, no asset files. */
function play(cls: SoundClass): void {
  if (!prefs.enabled) return;
  const ctx = getCtx();
  if (!ctx) return;
  // Resume on user-driven trigger if context was suspended by autoplay policy.
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});

  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(ctx.destination);

  if (cls === "critical") {
    // Two-tone descending pair, more attention-grabbing.
    pulse(ctx, gain, now, 880, 0.18);
    pulse(ctx, gain, now + 0.22, 660, 0.22);
  } else {
    // Single soft chirp for urgent workflow warning.
    pulse(ctx, gain, now, 540, 0.18);
  }
}

function pulse(
  ctx: AudioContext,
  out: GainNode,
  startAt: number,
  freq: number,
  durSec: number,
): void {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  const peak = Math.max(0.0001, prefs.volume);
  env.gain.setValueAtTime(0.0001, startAt);
  env.gain.exponentialRampToValueAtTime(peak, startAt + 0.02);
  env.gain.exponentialRampToValueAtTime(0.0001, startAt + durSec);
  osc.connect(env);
  env.connect(out);
  osc.start(startAt);
  osc.stop(startAt + durSec + 0.02);
}

function notify(): void {
  const summary: ActiveAlertSummary = {
    pendingCritical: pendingCritical.size,
    lastCriticalKey: lastKey(),
  };
  for (const l of listeners) l(summary);
}

function lastKey(): string | null {
  let last: string | null = null;
  let lastSince = -1;
  for (const [k, v] of pendingCritical) {
    if (v.since > lastSince) {
      lastSince = v.since;
      last = k;
    }
  }
  return last;
}

function ensureRepeatTimer(): void {
  if (repeatTimer) return;
  if (!prefs.repeatCritical) return;
  if (typeof window === "undefined") return;
  repeatTimer = setInterval(
    () => {
      if (!prefs.enabled || !prefs.repeatCritical) return;
      if (pendingCritical.size === 0) return;
      play("critical");
    },
    Math.max(5, prefs.repeatIntervalSec) * 1000,
  );
}

function clearRepeatTimer(): void {
  if (repeatTimer) {
    clearInterval(repeatTimer);
    repeatTimer = null;
  }
}

/** Public API ---------------------------------------------------------- */

export const soundEngine = {
  /** Update prefs at runtime; resets repeat loop accordingly. */
  setPrefs(next: SoundPrefs): void {
    prefs = next;
    clearRepeatTimer();
    if (next.enabled && next.repeatCritical && pendingCritical.size > 0) {
      ensureRepeatTimer();
    }
    notify();
  },

  getPrefs(): SoundPrefs {
    return prefs;
  },

  /** Emit a sound event — only call from observed state transitions. */
  emit(ev: SoundEvent): void {
    if (!prefs.enabled) return;
    if (ev.cls === "critical") {
      const isNew = !pendingCritical.has(ev.key);
      if (isNew) {
        pendingCritical.set(ev.key, { label: ev.label, since: Date.now() });
        play("critical");
        if (prefs.repeatCritical) ensureRepeatTimer();
        notify();
      }
      // Same critical key already pending → do not re-play immediately
      // (the repeat loop handles unacknowledged reminders).
      return;
    }
    // Urgent: play once per emit, no loop, no pending tracking.
    play("urgent");
  },

  /** Resolve a critical key (e.g. PHONE_OUT_REQUIRED gone) without user action. */
  resolve(key: string): void {
    if (pendingCritical.delete(key)) {
      if (pendingCritical.size === 0) clearRepeatTimer();
      notify();
    }
  },

  /** User-driven: silence the current repeating critical alert(s). */
  acknowledgeAll(): void {
    if (pendingCritical.size === 0) return;
    pendingCritical.clear();
    clearRepeatTimer();
    notify();
  },

  /** User-driven: play a single test sound (bypasses pending tracking). */
  test(cls: SoundClass): void {
    const wasEnabled = prefs.enabled;
    if (!wasEnabled) {
      // Allow test even when globally disabled, so users can preview before enabling.
      const ctx = getCtx();
      if (!ctx) return;
      if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    }
    // Temporarily force enabled for this single playback.
    const prev = prefs;
    prefs = { ...prev, enabled: true };
    play(cls);
    prefs = prev;
  },

  subscribe(l: Listener): () => void {
    listeners.add(l);
    l({ pendingCritical: pendingCritical.size, lastCriticalKey: lastKey() });
    return () => {
      listeners.delete(l);
    };
  },

  /** Test-only / shutdown helper. */
  _reset(): void {
    pendingCritical.clear();
    clearRepeatTimer();
    notify();
  },
};

/** Codes classified as critical alerts (release-blocking, patient-safety). */
export const CRITICAL_VALIDATION_CODES = new Set<string>([
  "PHONE_OUT_REQUIRED",
  "SEAL_MISMATCH", // future-classified release integrity blocker
]);

/** Codes classified as urgent workflow warnings (action required, not life-safety). */
export const URGENT_VALIDATION_CODES = new Set<string>(["CONSULTANT_APPROVAL_REQUIRED"]);

/** IPC rule codes considered high-priority (urgent). */
export const HIGH_PRIORITY_IPC_CODES = new Set<string>([
  "CRE_ALERT",
  "CRAB_ALERT",
  "CRPA_ALERT",
  "CAURIS_ALERT",
  "MRSA_ALERT",
  "VRE_ALERT",
]);
