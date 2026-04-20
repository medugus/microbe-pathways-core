// Browser-phase per-receiver preferences.
//
// Stage 8 introduces an `autoDispatchOnRelease` flag per receiver. The
// receivers table itself is read-only from this client (schema is managed
// elsewhere), so we keep the flag in localStorage, scoped per tenant, and
// pass the resulting opt-out list to seal/amend server functions. The server
// honours the exclusion when fanning out auto-dispatch.
//
// Source of truth: the receivers table for identity/endpoint/format/enabled.
// This store ONLY layers an opt-out preference on top. When this later moves
// to a `receivers.auto_dispatch_on_release` column, the read API
// (`isAutoDispatchEnabled`, `getExcludedReceiverIds`) keeps the same shape.

const STORAGE_KEY = "medugu.receiverPrefs.v1";

interface PrefsShape {
  // tenantId → { receiverId → autoDispatchOnRelease }
  [tenantId: string]: { [receiverId: string]: boolean };
}

type Listener = () => void;

function readAll(): PrefsShape {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PrefsShape;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(next: PrefsShape) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota — ignore */
  }
}

const listeners = new Set<Listener>();

function notify() {
  for (const l of listeners) l();
}

export const receiverPrefs = {
  /**
   * Returns true if the receiver should auto-dispatch on release.
   * Default is TRUE — only an explicit opt-out toggles it off.
   */
  isAutoDispatchEnabled(tenantId: string, receiverId: string): boolean {
    const all = readAll();
    const v = all[tenantId]?.[receiverId];
    return v === undefined ? true : v;
  },

  setAutoDispatchEnabled(tenantId: string, receiverId: string, enabled: boolean) {
    const all = readAll();
    const tenant = { ...(all[tenantId] ?? {}) };
    if (enabled) {
      // Default is enabled — drop the explicit entry to keep storage tidy.
      delete tenant[receiverId];
    } else {
      tenant[receiverId] = false;
    }
    all[tenantId] = tenant;
    writeAll(all);
    notify();
  },

  /** Receiver IDs in this tenant the user has opted-out of auto-dispatch for. */
  getExcludedReceiverIds(tenantId: string): string[] {
    const tenant = readAll()[tenantId] ?? {};
    return Object.entries(tenant)
      .filter(([, v]) => v === false)
      .map(([id]) => id);
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
