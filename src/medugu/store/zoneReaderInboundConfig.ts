// Browser-phase inbound config for ZoneResult live send from Zone Reader.
//
// Scope boundaries:
//   - localStorage-backed, scoped per tenant (tokens) and per deployment
//     (production base URL override)
//   - exposes the endpoint URL Zone Reader must POST ZoneResult JSON to
//   - exposes a bearer token that Zone Reader must include as
//     `Authorization: Bearer <token>` on that POST
//   - generate / reset is the only mutation; the token is never auto-rotated
//   - this module does NOT create an inbound endpoint, does NOT verify
//     signatures, and does NOT poll. The actual receiver wiring is a future
//     deployment step. This store only surfaces what an operator/admin needs
//     to configure Zone Reader against the Medugu deployment.
//
// Production-safety hardening:
//   - the operator-facing "live endpoint URL" is NEVER derived from
//     window.location.origin alone. It is derived from an admin-configured
//     stable production base URL, falling back to the configured deployment
//     host. Preview origins (id-preview--*, preview--*, localhost)
//     must never be handed to Zone Reader for live send.

const STORAGE_KEY = "medugu.zoneReaderInbound.v1";
const BASE_URL_KEY = "medugu.zoneReaderInbound.baseUrl.v1";
const APP_URL_KEY = "medugu.zoneReader.appUrl.v1";
const ENDPOINT_PATH = "/api/public/zone-reader/result";

const FALLBACK_PRODUCTION_BASE_URL = "https://lims.example.com";
const FALLBACK_ZONE_READER_APP_URL = "https://reader.example.com/";

function normaliseHttpsOrigin(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:") return fallback;
    return url.origin;
  } catch {
    return fallback;
  }
}

function normaliseHttpsAppUrl(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:") return fallback;
    return url.href.endsWith("/") ? url.href : `${url.href}/`;
  } catch {
    return fallback;
  }
}

// Stable production hosts are deployment configuration. Set these as
// Cloudflare/GitHub environment variables for each deployment. The fallback is
// intentionally obvious so a missing production URL is visible during setup.
const DEFAULT_PRODUCTION_BASE_URL = normaliseHttpsOrigin(
  import.meta.env.VITE_MEDUGU_PUBLIC_BASE_URL,
  FALLBACK_PRODUCTION_BASE_URL,
);

/**
 * Built-in default URL of the Zone Reader web app. The "Launch Zone Reader"
 * action on the Hub and the AST Zone Reader panel opens this URL in a new
 * tab when no admin override is set. Must be a real https origin.
 */
const DEFAULT_APP_URL = normaliseHttpsAppUrl(
  import.meta.env.VITE_ZONE_READER_PUBLIC_URL,
  FALLBACK_ZONE_READER_APP_URL,
);

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
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Normalise a base URL: must be https, strip trailing slash. Returns null if invalid. */
function normaliseBaseUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "https:") return null;
    // discard any path/query/hash — we only want origin.
    return u.origin;
  } catch {
    return null;
  }
}

/** True if the current browser origin is a preview / non-production host. */
export function isPreviewHost(host?: string): boolean {
  if (typeof window === "undefined") return false;
  const h = host ?? window.location.hostname;
  if (!h) return false;
  if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".local")) return true;
  if (h.includes("id-preview--")) return true;
  if (h.includes("-preview--")) return true;
  if (h.includes("preview--")) return true;
  return false;
}

export const zoneReaderInboundConfig = {
  /** Default (built-in) production base URL — never derived from window.location. */
  getDefaultProductionBaseUrl(): string {
    return DEFAULT_PRODUCTION_BASE_URL;
  },

  /** Admin-configured production base URL override, or null if unset. */
  getProductionBaseUrlOverride(): string | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(BASE_URL_KEY);
      return raw ? raw : null;
    } catch {
      return null;
    }
  },

  /** Effective production base URL = override || default. Never the preview origin. */
  getProductionBaseUrl(): string {
    return this.getProductionBaseUrlOverride() ?? DEFAULT_PRODUCTION_BASE_URL;
  },

  /** Set the admin-configured production base URL. Validates https + URL shape. */
  setProductionBaseUrl(raw: string): { ok: true; value: string } | { ok: false; reason: string } {
    const normalised = normaliseBaseUrl(raw);
    if (!normalised) {
      return { ok: false, reason: "Must be a valid https:// URL (origin only)." };
    }
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(BASE_URL_KEY, normalised);
      } catch {
        return { ok: false, reason: "Could not persist base URL (storage full?)." };
      }
    }
    notify();
    return { ok: true, value: normalised };
  },

  /** Clear the override and fall back to the built-in default. */
  clearProductionBaseUrlOverride() {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(BASE_URL_KEY);
    } catch {
      /* ignore */
    }
    notify();
  },

  /** True iff the page is currently being served from a preview / dev host. */
  isPreviewEnvironment(): boolean {
    return isPreviewHost();
  },

  /** Current browser origin (for UI display only — never given to Zone Reader). */
  getCurrentOrigin(): string {
    if (typeof window === "undefined" || !window.location?.origin) return "";
    return window.location.origin;
  },

  /**
   * Fully-qualified endpoint URL Zone Reader must POST ZoneResult JSON to.
   * Always built from the stable production base URL, never from
   * window.location.origin.
   */
  getEndpointUrl(): string {
    return `${this.getProductionBaseUrl()}${ENDPOINT_PATH}`;
  },

  /** Path-only (for documentation / display). */
  getEndpointPath(): string {
    return ENDPOINT_PATH;
  },

  getToken(tenantId: string): { token: string; generatedAt: string } | null {
    const all = readAll();
    return all[tenantId] ?? null;
  },

  generateToken(tenantId: string): { token: string; generatedAt: string } {
    const all = readAll();
    const next = { token: randomToken(), generatedAt: new Date().toISOString() };
    all[tenantId] = next;
    writeAll(all);
    notify();
    return next;
  },

  revokeToken(tenantId: string) {
    const all = readAll();
    delete all[tenantId];
    writeAll(all);
    notify();
  },

  /** Built-in default Zone Reader app URL. */
  getDefaultAppUrl(): string {
    return DEFAULT_APP_URL;
  },

  /**
   * Effective Zone Reader app URL — admin override when set, otherwise the
   * built-in default. Returns `null` only when admin explicitly clears the
   * value AND no built-in default applies. The default ensures the launch
   * button is normally enabled out of the box.
   */
  getAppUrl(): string | null {
    if (typeof window === "undefined") return DEFAULT_APP_URL;
    try {
      const raw = window.localStorage.getItem(APP_URL_KEY);
      if (raw === "") return null; // explicit "cleared" sentinel
      return raw ?? DEFAULT_APP_URL;
    } catch {
      return DEFAULT_APP_URL;
    }
  },

  /** Admin-configured override, or null when no override is set. */
  getAppUrlOverride(): string | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(APP_URL_KEY);
      return raw && raw.length > 0 ? raw : null;
    } catch {
      return null;
    }
  },

  /**
   * Is the host of the configured Zone Reader app URL a preview host?
   * Reuses the same preview detection used for the Medugu origin so the UI
   * can warn when the launch target itself looks ephemeral.
   */
  isAppUrlOnPreviewHost(): boolean {
    const url = this.getAppUrl();
    if (!url) return false;
    try {
      return isPreviewHost(new URL(url).hostname);
    } catch {
      return false;
    }
  },

  /** Set the Zone Reader app URL. Validates https + URL shape. */
  setAppUrl(raw: string): { ok: true; value: string } | { ok: false; reason: string } {
    const trimmed = raw.trim();
    if (!trimmed) return { ok: false, reason: "Enter an https:// URL." };
    let normalised: string;
    try {
      const u = new URL(trimmed);
      if (u.protocol !== "https:") {
        return { ok: false, reason: "URL must use https://." };
      }
      // Keep origin + path (drop hash/search) so deployments can host the app
      // under a subpath if needed.
      normalised = u.origin + (u.pathname === "/" ? "" : u.pathname.replace(/\/$/, ""));
    } catch {
      return { ok: false, reason: "Not a valid URL." };
    }
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(APP_URL_KEY, normalised);
      } catch {
        return { ok: false, reason: "Could not persist app URL (storage full?)." };
      }
    }
    notify();
    return { ok: true, value: normalised };
  },

  clearAppUrl() {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(APP_URL_KEY);
    } catch {
      /* ignore */
    }
    notify();
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
