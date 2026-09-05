import { afterEach, describe, it, vi } from "vitest";
import { strict as assert } from "node:assert";
import { __test } from "../../../../routes/api.public.zone-reader.result";

const validPayload = {
  contractVersion: "1.0.0",
  sourceSystem: "DISKDIFF_READER",
  readAt: "2026-06-12T10:00:00.000Z",
  accessionId: "acc-1",
  accessionNumber: "ACC-001",
  isolateId: "iso-1",
  astPanelId: "panel-1",
  method: "disk_diffusion",
  standard: "EUCAST",
  notForClinicalRelease: true,
  releaseAuthority: "LIS",
  readerDeviceId: "reader-1",
  readerSoftwareVersion: "1.0.0",
  operator: "operator-1",
  results: [{
    antibioticCode: "AMP",
    zoneDiameterMm: 18,
    readerConfidence: "high",
    measurementSource: "auto_reader",
    manualEdited: false,
  }],
};

function request(init: { auth?: string; contentType?: string; body?: unknown } = {}): Request {
  const headers = new Headers();
  if (init.auth) headers.set("authorization", init.auth);
  if (init.contentType) headers.set("content-type", init.contentType);
  return new Request("https://example.test/api/public/zone-reader/result", {
    method: "POST",
    headers,
    body: init.body === undefined
      ? undefined
      : typeof init.body === "string"
        ? init.body
        : JSON.stringify(init.body),
  });
}

async function run() {
  const getResponse = await __test.handlers.GET();
  assert.equal(getResponse.status, 200);
  assert.equal(((await getResponse.json()) as { persistence: string }).persistence, "durable");

  let persisted = 0;
  const accepted = await __test.handlers.POST(
    request({
      auth: "Bearer server-secret",
      contentType: "application/json",
      body: validPayload,
    }),
    {
      expectedToken: "server-secret",
      tenantId: "tenant-1",
      persist: async (_payload, contentHash, tenantId) => {
        persisted += 1;
        assert.equal(contentHash.length, 64);
        assert.equal(tenantId, "tenant-1");
        return { receiptId: "receipt-1", status: "pending_review", idempotent: false };
      },
    },
  );
  assert.equal(accepted.status, 202);
  assert.equal(persisted, 1);
  const acceptedBody = (await accepted.json()) as {
    receiptId: string;
    status: string;
    mappedRowIds: string[];
  };
  assert.equal(acceptedBody.receiptId, "receipt-1");
  assert.equal(acceptedBody.status, "pending_review");
  assert.deepEqual(acceptedBody.mappedRowIds, []);

  const duplicate = await __test.handlers.POST(
    request({
      auth: "Bearer server-secret",
      contentType: "application/json",
      body: validPayload,
    }),
    {
      expectedToken: "server-secret",
      tenantId: "tenant-1",
      persist: async () => ({
        receiptId: "receipt-existing",
        status: "pending_review",
        idempotent: true,
      }),
    },
  );
  assert.equal(duplicate.status, 200);
  assert.equal(((await duplicate.json()) as { idempotent: boolean }).idempotent, true);

  const unauthorized = await __test.handlers.POST(
    request({
      auth: "Bearer wrong-secret",
      contentType: "application/json",
      body: validPayload,
    }),
    {
      expectedToken: "server-secret",
      tenantId: "tenant-1",
      persist: async () => {
        throw new Error("must not persist");
      },
    },
  );
  assert.equal(unauthorized.status, 403);

  const unsafe = await __test.handlers.POST(
    request({
      auth: "Bearer server-secret",
      contentType: "application/json",
      body: { ...validPayload, notForClinicalRelease: false },
    }),
    {
      expectedToken: "server-secret",
      tenantId: "tenant-1",
      persist: async () => {
        throw new Error("must not persist");
      },
    },
  );
  assert.equal(unsafe.status, 422);

  const unconfigured = await __test.handlers.POST(
    request({
      auth: "Bearer server-secret",
      contentType: "application/json",
      body: validPayload,
    }),
    {
      expectedToken: "",
      tenantId: "",
      persist: async () => {
        throw new Error("must not persist");
      },
    },
  );
  assert.equal(unconfigured.status, 503);
  assert.equal(
    ((await unconfigured.json()) as { reason: string }).reason,
    "integration_not_configured",
  );

  // eslint-disable-next-line no-console
  console.log("publicInboundRoute.test ok");
}

describe("public Zone Reader inbound route", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("accepts, deduplicates and rejects inbound result payloads correctly", async () => {
    vi.stubEnv("ZONE_READER_INBOUND_TOKEN", "server-secret");
    vi.stubEnv("ZONE_READER_TENANT_ID", "tenant-1");
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
    await run();
  });
});
