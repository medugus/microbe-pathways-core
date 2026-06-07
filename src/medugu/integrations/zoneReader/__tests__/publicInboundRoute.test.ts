// Tests for the public ZoneResult inbound route.
// Plain node:assert style to match other tests in this folder.

import { strict as assert } from "node:assert";
import { __test } from "../../../../routes/api.public.zone-reader.result";

const validHex = "a".repeat(64);

function req(
  method: string,
  init: { auth?: string; contentType?: string; body?: unknown } = {},
): Request {
  const headers = new Headers();
  if (init.auth) headers.set("authorization", init.auth);
  if (init.contentType) headers.set("content-type", init.contentType);
  return new Request("https://example.test/api/public/zone-reader/result", {
    method,
    headers,
    body:
      init.body === undefined
        ? undefined
        : typeof init.body === "string"
          ? init.body
          : JSON.stringify(init.body),
  });
}

async function run() {
  delete process.env.ZONE_READER_INBOUND_TOKEN;

  // OPTIONS preflight
  {
    const res = await __test.handlers.OPTIONS(req("OPTIONS"));
    assert.equal(res.status, 204);
    assert.ok(res.headers.get("access-control-allow-methods")?.includes("POST"));
    assert.ok(
      res.headers.get("access-control-allow-headers")?.includes("Authorization"),
    );
  }

  // GET liveness (route exists, not 404)
  {
    const res = await __test.handlers.GET(req("GET"));
    assert.equal(res.status, 200);
    const body = (await res.json()) as { ok: boolean; route: string };
    assert.equal(body.ok, true);
    assert.equal(body.route, "/api/public/zone-reader/result");
  }

  // POST valid hex token + JSON body → 202
  {
    const res = await __test.handlers.POST(
      req("POST", {
        auth: `Bearer ${validHex}`,
        contentType: "application/json",
        body: { worklistId: "w1", results: [] },
      }),
    );
    assert.equal(res.status, 202);
    const body = (await res.json()) as { ok: boolean; accepted: boolean };
    assert.equal(body.ok, true);
    assert.equal(body.accepted, true);
  }

  // POST missing Authorization → 401
  {
    const res = await __test.handlers.POST(
      req("POST", { contentType: "application/json", body: {} }),
    );
    assert.equal(res.status, 401);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "missing_authorization");
  }

  // POST malformed Authorization scheme → 401
  {
    const res = await __test.handlers.POST(
      req("POST", {
        auth: "Token abc",
        contentType: "application/json",
        body: {},
      }),
    );
    assert.equal(res.status, 401);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "malformed_authorization");
  }

  // POST structurally invalid token → 403
  {
    const res = await __test.handlers.POST(
      req("POST", {
        auth: "Bearer not-a-real-token",
        contentType: "application/json",
        body: {},
      }),
    );
    assert.equal(res.status, 403);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "invalid_token");
  }

  // POST honors ZONE_READER_INBOUND_TOKEN when set
  {
    process.env.ZONE_READER_INBOUND_TOKEN = "server-side-secret";
    const bad = await __test.handlers.POST(
      req("POST", {
        auth: `Bearer ${validHex}`,
        contentType: "application/json",
        body: {},
      }),
    );
    assert.equal(bad.status, 403);
    const good = await __test.handlers.POST(
      req("POST", {
        auth: "Bearer server-side-secret",
        contentType: "application/json",
        body: {},
      }),
    );
    assert.equal(good.status, 202);
    delete process.env.ZONE_READER_INBOUND_TOKEN;
  }

  // POST without JSON content-type → 415
  {
    const res = await __test.handlers.POST(
      req("POST", { auth: `Bearer ${validHex}`, body: "raw" }),
    );
    assert.equal(res.status, 415);
  }

  // POST with invalid JSON → 400
  {
    const res = await __test.handlers.POST(
      req("POST", {
        auth: `Bearer ${validHex}`,
        contentType: "application/json",
        body: "{not json",
      }),
    );
    assert.equal(res.status, 400);
  }

  console.log("publicInboundRoute.test ok");
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
