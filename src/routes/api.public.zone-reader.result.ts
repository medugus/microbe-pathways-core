import { createFileRoute } from "@tanstack/react-router";
import { zoneReaderResultImportSchema } from "@/medugu/integrations/zoneReader/schemas";
import type { ZoneReaderResultImport } from "@/medugu/integrations/zoneReader/types";

const ROUTE_PATH = "/api/public/zone-reader/result";
const TOKEN_ENV = "ZONE_READER_INBOUND_TOKEN";
const TENANT_ENV = "ZONE_READER_TENANT_ID";
const SUPABASE_URL_ENV = "SUPABASE_URL";
const SERVICE_KEY_ENV = "SUPABASE_SERVICE_ROLE_KEY";

type Receipt = {
  receiptId: string;
  status: "pending_review";
  idempotent: boolean;
};

type InboundDependencies = {
  expectedToken?: string;
  tenantId?: string;
  persist: (
    payload: ZoneReaderResultImport,
    contentHash: string,
    tenantId: string,
  ) => Promise<Receipt>;
};

function readEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": readEnv("ZONE_READER_ALLOWED_ORIGIN") || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function bearerToken(request: Request):
  | { ok: true; token: string }
  | { ok: false; response: Response } {
  const header = request.headers.get("authorization")?.trim() ?? "";
  if (!header) {
    return {
      ok: false,
      response: json(401, {
        ok: false,
        reason: "missing_authorization",
        details: ["Authorization header is required."],
      }),
    };
  }
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match?.[1]?.trim()) {
    return {
      ok: false,
      response: json(401, {
        ok: false,
        reason: "malformed_authorization",
        details: ["Use Authorization: Bearer <token>."],
      }),
    };
  }
  return { ok: true, token: match[1].trim() };
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function tokenMatches(provided: string, expected: string): Promise<boolean> {
  const [providedHash, expectedHash] = await Promise.all([
    sha256(provided),
    sha256(expected),
  ]);
  let difference = providedHash.length ^ expectedHash.length;
  const length = Math.max(providedHash.length, expectedHash.length);
  for (let index = 0; index < length; index += 1) {
    difference |=
      (providedHash.charCodeAt(index) || 0) ^
      (expectedHash.charCodeAt(index) || 0);
  }
  return difference === 0;
}

async function queryExisting(
  baseUrl: string,
  serviceKey: string,
  tenantId: string,
  contentHash: string,
): Promise<Receipt | null> {
  const url = new URL(`${baseUrl}/rest/v1/zone_reader_inbound_messages`);
  url.searchParams.set("tenant_id", `eq.${tenantId}`);
  url.searchParams.set("content_hash", `eq.${contentHash}`);
  url.searchParams.set("select", "id,status");
  url.searchParams.set("limit", "1");
  const response = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Supabase lookup failed with status ${response.status}.`);
  }
  const rows = (await response.json()) as Array<{
    id: string;
    status: "pending_review";
  }>;
  return rows[0]
    ? { receiptId: rows[0].id, status: rows[0].status, idempotent: true }
    : null;
}

async function persistToSupabase(
  payload: ZoneReaderResultImport,
  contentHash: string,
  tenantId: string,
): Promise<Receipt> {
  const baseUrl = readEnv(SUPABASE_URL_ENV).replace(/\/$/, "");
  const serviceKey = readEnv(SERVICE_KEY_ENV);
  if (!baseUrl || !serviceKey) {
    throw new Error(
      `${SUPABASE_URL_ENV} and ${SERVICE_KEY_ENV} are required for Zone Reader ingestion.`,
    );
  }

  const existing = await queryExisting(baseUrl, serviceKey, tenantId, contentHash);
  if (existing) return existing;

  const response = await fetch(
    `${baseUrl}/rest/v1/zone_reader_inbound_messages`,
    {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        tenant_id: tenantId,
        content_hash: contentHash,
        contract_version: payload.contractVersion,
        source_system: payload.sourceSystem,
        accession_id: payload.accessionId,
        accession_number: payload.accessionNumber ?? null,
        isolate_id: payload.isolateId,
        ast_panel_id: payload.astPanelId,
        read_at: payload.readAt,
        payload,
        status: "pending_review",
      }),
    },
  );

  if (response.status === 409) {
    const duplicate = await queryExisting(baseUrl, serviceKey, tenantId, contentHash);
    if (duplicate) return duplicate;
  }
  if (!response.ok) {
    throw new Error(`Supabase insert failed with status ${response.status}.`);
  }
  const rows = (await response.json()) as Array<{
    id: string;
    status: "pending_review";
  }>;
  const row = rows[0];
  if (!row) throw new Error("Supabase did not return an inbound receipt.");
  return { receiptId: row.id, status: row.status, idempotent: false };
}

export async function handleZoneReaderInbound(
  request: Request,
  dependencies: InboundDependencies = {
    expectedToken: readEnv(TOKEN_ENV),
    tenantId: readEnv(TENANT_ENV),
    persist: persistToSupabase,
  },
): Promise<Response> {
  const expectedToken = dependencies.expectedToken?.trim() ?? "";
  const tenantId = dependencies.tenantId?.trim() ?? "";
  if (!expectedToken || !tenantId) {
    return json(503, {
      ok: false,
      reason: "integration_not_configured",
      details: [
        `${TOKEN_ENV} and ${TENANT_ENV} must be configured on the server.`,
      ],
    });
  }

  const auth = bearerToken(request);
  if (!auth.ok) return auth.response;
  if (!(await tokenMatches(auth.token, expectedToken))) {
    return json(403, {
      ok: false,
      reason: "invalid_token",
      details: ["Bearer token is not authorized."],
    });
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return json(415, {
      ok: false,
      reason: "unsupported_media_type",
      details: ["Content-Type must be application/json."],
    });
  }

  let candidate: unknown;
  try {
    candidate = await request.json();
  } catch {
    return json(400, {
      ok: false,
      reason: "invalid_json",
      details: ["Request body could not be parsed as JSON."],
    });
  }

  const parsed = zoneReaderResultImportSchema.safeParse(candidate);
  if (!parsed.success) {
    return json(422, {
      ok: false,
      reason: "schema_validation_failed",
      details: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`,
      ),
    });
  }
  if (
    parsed.data.sourceSystem !== "DISKDIFF_READER" ||
    !parsed.data.standard ||
    parsed.data.notForClinicalRelease !== true ||
    parsed.data.releaseAuthority !== "LIS"
  ) {
    return json(422, {
      ok: false,
      reason: "clinical_authority_boundary_failed",
      details: [
        'Payload must use sourceSystem="DISKDIFF_READER", declare a breakpoint standard, assert notForClinicalRelease=true, and set releaseAuthority="LIS".',
      ],
    });
  }

  const contentHash = await sha256(JSON.stringify(parsed.data));
  try {
    const receipt = await dependencies.persist(
      parsed.data,
      contentHash,
      tenantId,
    );
    return json(receipt.idempotent ? 200 : 202, {
      ok: true,
      accepted: true,
      receiptId: receipt.receiptId,
      auditId: receipt.receiptId,
      status: receipt.status,
      idempotent: receipt.idempotent,
      mappedRowIds: [],
      message:
        "Zone Result stored in the Medugu inbound queue. Clinical review is required before AST rows are updated.",
    });
  } catch (error) {
    console.error("Zone Reader inbound persistence failed", error);
    return json(503, {
      ok: false,
      reason: "persistence_unavailable",
      details: ["Medugu could not durably store the Zone Result. Retry later."],
    });
  }
}

export function handleZoneReaderReadiness(): Response {
  const configured = [TOKEN_ENV, TENANT_ENV, SUPABASE_URL_ENV, SERVICE_KEY_ENV]
    .every((name) => Boolean(readEnv(name)));
  return json(configured ? 200 : 503, {
    ok: configured,
    route: ROUTE_PATH,
    accepts: "ZoneResult contract v1",
    persistence: "durable",
    clinicalAuthority: "LIS",
    configurationReady: configured,
    // This inexpensive public check does not query or expose patient records.
    databaseVerified: false,
    ...(!configured ? { reason: "integration_not_configured" } : {}),
  });
}

export const Route = createFileRoute("/api/public/zone-reader/result")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: corsHeaders() }),
      GET: async () => handleZoneReaderReadiness(),
      POST: async ({ request }) => handleZoneReaderInbound(request),
    },
  },
});

export const __test = {
  ROUTE_PATH,
  handlers: {
    OPTIONS: async () =>
      new Response(null, { status: 204, headers: corsHeaders() }),
    GET: async () => handleZoneReaderReadiness(),
    POST: handleZoneReaderInbound,
  },
};
