// /settings/sounds — browser-phase sound preferences.
// Local-only (localStorage). No server sync, no cross-device propagation.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/auth/RequireAuth";
import {
  loadSoundPrefs,
  saveSoundPrefs,
  type SoundPrefs,
} from "@/medugu/store/soundPrefs";
import { soundEngine } from "@/medugu/logic/soundEngine";

export const Route = createFileRoute("/settings/sounds")({
  component: SoundsSettingsRoute,
});

function SoundsSettingsRoute() {
  return (
    <RequireAuth>
      <SoundsSettings />
    </RequireAuth>
  );
}

function SoundsSettings() {
  const [prefs, setPrefs] = useState<SoundPrefs>(() => loadSoundPrefs());
  const [pending, setPending] = useState(0);

  useEffect(() => {
    soundEngine.setPrefs(prefs);
    saveSoundPrefs(prefs);
  }, [prefs]);

  useEffect(() => soundEngine.subscribe((s) => setPending(s.pendingCritical)), []);

  function update<K extends keyof SoundPrefs>(k: K, v: SoundPrefs[K]) {
    setPrefs((p) => ({ ...p, [k]: v }));
  }

  return (
    <div className="min-h-screen bg-app text-foreground">
      <header className="border-b border-border bg-panel px-6 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold">Sound preferences</h1>
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
            ← Back to workspace
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 p-6">
        <div className="callout callout-warning text-[11px]">
          Browser-phase only — preferences are stored in this browser's
          localStorage. Sound is an alert affordance, never the sole signal.
          Visible chips, banners, and blocker text remain authoritative.
        </div>

        <section className="rounded-md border border-border bg-panel p-4">
          <h2 className="text-sm font-semibold">Playback</h2>
          <div className="mt-3 space-y-3">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>Enable alert sounds</span>
              <input
                type="checkbox"
                checked={prefs.enabled}
                onChange={(e) => update("enabled", e.target.checked)}
              />
            </label>

            <label className="block text-sm">
              <div className="flex items-baseline justify-between">
                <span>Volume</span>
                <span className="text-[11px] text-muted-foreground">
                  {Math.round(prefs.volume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={prefs.volume}
                onChange={(e) => update("volume", Number(e.target.value))}
                className="mt-1 w-full"
                aria-label="Alert volume"
              />
            </label>
          </div>
        </section>

        <section className="rounded-md border border-border bg-panel p-4">
          <h2 className="text-sm font-semibold">Critical alerts</h2>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Triggered for: PHONE_OUT_REQUIRED, SEAL_MISMATCH (and other
            release-blocking events explicitly classified as critical).
          </p>
          <div className="mt-3 space-y-3">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>Repeat unacknowledged critical alerts</span>
              <input
                type="checkbox"
                checked={prefs.repeatCritical}
                onChange={(e) => update("repeatCritical", e.target.checked)}
              />
            </label>

            <label className="block text-sm">
              <div className="flex items-baseline justify-between">
                <span>Repeat interval (seconds)</span>
                <span className="text-[11px] text-muted-foreground">
                  {prefs.repeatIntervalSec}s
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={120}
                step={5}
                value={prefs.repeatIntervalSec}
                onChange={(e) => update("repeatIntervalSec", Number(e.target.value))}
                className="mt-1 w-full"
                disabled={!prefs.repeatCritical}
                aria-label="Repeat interval"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => soundEngine.test("critical")}
                className="rounded border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted"
              >
                Test critical sound
              </button>
              <button
                type="button"
                onClick={() => soundEngine.acknowledgeAll()}
                disabled={pending === 0}
                className="rounded bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground disabled:opacity-50"
              >
                Silence current alert ({pending})
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-md border border-border bg-panel p-4">
          <h2 className="text-sm font-semibold">Urgent workflow warnings</h2>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Triggered for: CONSULTANT_APPROVAL_REQUIRED, new high-priority IPC
            alerts (CRE/CRAB/CRPA/CAURIS/MRSA/VRE), and dispatch failures.
            These play once per transition and never loop.
          </p>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => soundEngine.test("urgent")}
              className="rounded border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted"
            >
              Test urgent sound
            </button>
          </div>
        </section>

        <section className="rounded-md border border-border bg-panel p-4 text-[11px] text-muted-foreground">
          <h2 className="mb-1 text-sm font-semibold text-foreground">
            Accessibility &amp; safety
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Sound is never the sole signal — visible chips, banners, and blocker text remain authoritative.</li>
            <li>Sounds fire only on observed state transitions, never on rerender.</li>
            <li>Routine warnings (missing microscopy, AMS pending, draft AST) are silent.</li>
            <li>No autoplay on page load; the audio context activates on the first user-driven trigger.</li>
            <li>Repeating critical alerts can be silenced from this page or from the header chip.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
