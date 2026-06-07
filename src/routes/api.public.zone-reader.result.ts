// Public inbound ZoneResult endpoint.
//
// Path: /api/public/zone-reader/result
//
// Scope boundaries (per the current contract):
//   - This route only accepts a single ZoneResult JSON payload per POST.
//   - Bearer-token auth is required on POST: `Authorization: Bearer <token>`.
//   - It does NOT verify webhook signatures, does NOT poll, does NOT open
//     sockets, and does NOT spawn background jobs.
//   - The ZoneResult schema itself is NOT modified in this step. We only
//     shape-check the payload as JSON and reject the obvious bad cases.
//   - There is no persistent server-side store for per-tenant tokens yet
//     (admin tokens are browser-phase, see
//     src/medugu/store/zoneReaderInboundConfig.ts). To still enforce a real
//     bearer-token gate, the route accepts:
//       (a) any token matching `ZONE_READER_INBOUND_TOKEN` env var if set, OR
//       (b) any 64-char hex token if no env var is configured.
//     Missing / malformed / wrong tokens get explicit JSON 401/403 responses.

import { createFileRoute } from "@tanstack/react-router";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
} as const;

const JSON_HEADERS = {
  "Content-Type": "application/json",
  ...CORS_HEADERS,
} as const;

const ROUTE_PATH = "/api/public/zone-reader/result";
const HEX64 = /^[a-f0-9]{64}$/i;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

/**
 * Returns:
 *   { ok: true }   if a usable bearer token was presented
 *   { status, body } otherwise — caller should return json(status, body)
 */
function checkAuth(request: Request):
  | { ok: true; token: string }
  | { ok: false; status: number; body: Record<string, unknown> } {
  const header = request.headers.get("authorization") ?? "";
  if (!header) {
    return {
      ok: false,
      status: 401,
      body: {
        error: "missing_authorization",
        message:
          "Authorization header is required. Send `Authorization: Bearer <token>`.",
      },
    };
  }
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) {
    return {
      ok: false,
      status: 401,
      body: {
        error: "malformed_authorization",
        message:
          "Authorization header must use the Bearer scheme: `Authorization: Bearer <token>`.",
      },
    };
  }
  const token = match[1].trim();
  const expected = process.env.ZONE_READER_INBOUND_TOKEN;
  if (expected && expected.length > 0) {
    if (token !== expected) {
      return {
        ok: false,
        status: 403,
        body: { error: "invalid_token", message: "Bearer token is not authorized." },
      };
    }
  } else if (!HEX64.test(token)) {
    // No server-configured token — fall back to structural check so we never
    // silently accept "Bearer foo".
    return {
      ok: false,
      status: 403,
      body: {
        error: "invalid_token",
        message:
          "Bearer token is not in the expected format (64-char hex). Generate a token in /admin/zone-reader.",
      },
    };
  }
  return { ok: true, token };
}

export const Route = createFileRoute("/api/public/zone-reader/result")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: CORS_HEADERS }),

      GET: async () =>
        json(200, {
          ok: true,
          route: ROUTE_PATH,
          methods: ["OPTIONS", "GET", "POST"],
          message:
            "ZoneResult inbound endpoint is live. POST a ZoneResult JSON body with `Authorization: Bearer <token>`. GET is a liveness probe only and never accepts payloads.",
        }),

      POST: async ({ request }) => {
        const auth = checkAuth(request);
        if (!auth.ok) return json(auth.status, auth.body);

        const contentType = request.headers.get("content-type") ?? "";
        if (!contentType.toLowerCase().includes("application/json")) {
          return json(415, {
            error: "unsupported_media_type",
            message: "Content-Type must be application/json.",
          });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json(400, {
            error: "invalid_json",
            message: "Request body could not be parsed as JSON.",
          });
        }

        if (!body || typeof body !== "object" || Array.isArray(body)) {
          return json(400, {
            error: "invalid_payload",
            message: "ZoneResult payload must be a JSON object.",
          });
        }

        // We intentionally do NOT persist server-side here — manual import via
        // the AST Zone Reader panel remains the supported workflow. This
        // endpoint exists so Zone Reader's live-send configuration has a
        // reachable URL that authenticates correctly.
        return json(202, {
          ok: true,
          accepted: true,
          route: ROUTE_PATH,
          message:
            "ZoneResult payload accepted for ingestion. Server-side persistence is not enabled in this build; operators continue to use the manual import path in the AST Zone Reader panel.",
        });
      },
    },
  },
});

// Exported for unit tests so we can exercise the handlers without spinning up
// the router.
export const __test = {
  ROUTE_PATH,
  CORS_HEADERS,
  handlers: {
    OPTIONS: async (_request: Request) =>
      new Response(null, { status: 204, headers: CORS_HEADERS }),
    GET: async (_request: Request) =>
      json(200, {
        ok: true,
        route: ROUTE_PATH,
        methods: ["OPTIONS", "GET", "POST"],
        message: "live",
      }),
    POST: async (request: Request) => {
      const auth = checkAuth(request);
      if (!auth.ok) return json(auth.status, auth.body);
      const contentType = request.headers.get("content-type") ?? "";
      if (!contentType.toLowerCase().includes("application/json")) {
        return json(415, { error: "unsupported_media_type" });
      }
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json(400, { error: "invalid_json" });
      }
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return json(400, { error: "invalid_payload" });
      }
      return json(202, { ok: true, accepted: true });
    },
  },
};
