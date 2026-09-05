import { afterEach, describe, expect, it, vi } from "vitest";
import { handleZoneReaderInbound, handleZoneReaderReadiness } from "../api.public.zone-reader.result";
import type { ZoneReaderResultImport } from "../../medugu/integrations/zoneReader/types";

const payload = {
  contractVersion: "1.0.0",
  sourceSystem: "DISKDIFF_READER",
  readAt: "2026-06-20T10:00:00.000Z",
  accessionId: "acc-1",
  accessionNumber: "MB25-TEST",
  isolateId: "iso-1",
  astPanelId: "enterobacterales",
  method: "disk_diffusion",
  standard: "EUCAST",
  notForClinicalRelease: true,
  releaseAuthority: "LIS",
  results: [
    {
      antibioticCode: "AMC",
      zoneDiameterMm: 22,
      measurementSource: "manual_entry",
    },
  ],
};

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://lims.example/api/public/zone-reader/result", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("Zone Reader inbound API", () => {
  afterEach(() => vi.unstubAllEnvs());

  const integrationEnv = {
    ZONE_READER_INBOUND_TOKEN: "test-inbound-secret",
    ZONE_READER_TENANT_ID: "test-tenant",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-secret",
  };

  it.each(Object.keys(integrationEnv))("reports unready when %s is missing", async (missing) => {
    for (const [name, value] of Object.entries(integrationEnv)) vi.stubEnv(name, value);
    vi.stubEnv(missing, "   ");
    const response = handleZoneReaderReadiness();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      ok: false, configurationReady: false, reason: "integration_not_configured",
    });
  });

  it("reports configuration readiness without claiming database verification or revealing secrets", async () => {
    for (const [name, value] of Object.entries(integrationEnv)) vi.stubEnv(name, value);
    const response = handleZoneReaderReadiness();
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(JSON.parse(body)).toMatchObject({
      ok: true, configurationReady: true, databaseVerified: false,
    });
    for (const value of Object.values(integrationEnv)) expect(body).not.toContain(value);
  });

  it("rejects missing bearer tokens before attempting persistence", async () => {
    let persisted = false;

    const response = await handleZoneReaderInbound(request(payload), {
      expectedToken: "secret-token",
      tenantId: "tenant-1",
      persist: async () => {
        persisted = true;
        throw new Error("should not persist");
      },
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      ok: false,
      reason: "missing_authorization",
    });
    expect(persisted).toBe(false);
  });

  it("stores valid Zone Result payloads as pending LIMS review receipts", async () => {
    let persisted: { payload: ZoneReaderResultImport; hash: string; tenantId: string } | null = null;

    const response = await handleZoneReaderInbound(
      request(payload, { authorization: "Bearer secret-token" }),
      {
        expectedToken: "secret-token",
        tenantId: "tenant-1",
        persist: async (zonePayload, contentHash, tenantId) => {
          persisted = { payload: zonePayload, hash: contentHash, tenantId };
          return { receiptId: "receipt-1", status: "pending_review", idempotent: false };
        },
      },
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({
      ok: true,
      accepted: true,
      receiptId: "receipt-1",
      status: "pending_review",
    });
    expect(persisted).not.toBeNull();
    expect(persisted!.tenantId).toBe("tenant-1");
    expect(persisted!.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(persisted!.payload.results[0]?.zoneDiameterMm).toBe(22);
  });

  it("rejects payloads that try to cross the clinical authority boundary", async () => {
    let persisted = false;

    const response = await handleZoneReaderInbound(
      request(
        {
          ...payload,
          notForClinicalRelease: false,
        },
        { authorization: "Bearer secret-token" },
      ),
      {
        expectedToken: "secret-token",
        tenantId: "tenant-1",
        persist: async () => {
          persisted = true;
          throw new Error("should not persist");
        },
      },
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      ok: false,
      reason: "clinical_authority_boundary_failed",
    });
    expect(persisted).toBe(false);
  });
});
