// Browser-phase inbound config for ZoneResult live send from Zone Reader.
//
// Scope boundaries:
//   - localStorage-backed, scoped per tenant
//   - exposes the endpoint URL Zone Reader must POST ZoneResult JSON to
//   - exposes a bearer token that Zone Reader must include as
//     `Authorization: Bearer <token>` on that POST
//   - generate / reset is the only mutation; the token is never auto-rotated
//   - this module does NOT create an inbound endpoint, does NOT verify
//     signatures, and does NOT poll. The actual receiver wiring is a future
//     deployment step. This store only surfaces what an operator/admin needs
//     to configure Zone Reader against the Medugu deployment.

const STORAGE_KEY = "medugu.zoneReaderInbound.v1";
const ENDPOINT_PATH = "/api/public/zone-reader/result";

interface Shape {
  // tenantId → token
  [tenantId: string]: { token: string; generatedAt: string } | undefined;
}

type Listener = () => void;

function readAll(): Shape {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Shape;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(next: Shape) {
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

function randomToken(): string {
  // 32 bytes → hex (browser-phase only).
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Fallback (should not happen in a real browser).
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const zoneReaderInboundConfig = {
  /** Fully-qualified endpoint URL Zone Reader must POST ZoneResult JSON to. */
  getEndpointUrl(): string {
    const origin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "";
    return `${origin}${ENDPOINT_PATH}`;
  },

  /** Path-only (for documentation / display). */
  getEndpointPath(): string {
    return ENDPOINT_PATH;
  },

  /** Current bearer token for the tenant, or null if none has been generated. */
  getToken(tenantId: string): { token: string; generatedAt: string } | null {
    const all = readAll();
    return all[tenantId] ?? null;
  },

  /** Generate (or regenerate / reset) the bearer token for the tenant. */
  generateToken(tenantId: string): { token: string; generatedAt: string } {
    const all = readAll();
    const next = { token: randomToken(), generatedAt: new Date().toISOString() };
    all[tenantId] = next;
    writeAll(all);
    notify();
    return next;
  },

  /** Revoke (clear) the bearer token for the tenant. */
  revokeToken(tenantId: string) {
    const all = readAll();
    delete all[tenantId];
    writeAll(all);
    notify();
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
