import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { __test } from "@/routes/api.public.zone-reader.result";

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

describe("public ZoneResult inbound route", () => {
  beforeEach(() => {
    delete process.env.ZONE_READER_INBOUND_TOKEN;
  });
  afterEach(() => {
    delete process.env.ZONE_READER_INBOUND_TOKEN;
  });

  it("OPTIONS returns 204 with CORS headers (preflight)", async () => {
    const res = await __test.handlers.OPTIONS(req("OPTIONS"));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
    expect(res.headers.get("access-control-allow-headers")).toContain(
      "Authorization",
    );
  });

  it("GET returns 200 JSON liveness (route exists, not 404)", async () => {
    const res = await __test.handlers.GET(req("GET"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; route: string };
    expect(body.ok).toBe(true);
    expect(body.route).toBe("/api/public/zone-reader/result");
  });

  it("POST with valid hex bearer token + JSON body returns 202", async () => {
    const res = await __test.handlers.POST(
      req("POST", {
        auth: `Bearer ${validHex}`,
        contentType: "application/json",
        body: { worklistId: "w1", results: [] },
      }),
    );
    expect(res.status).toBe(202);
    const body = (await res.json()) as { ok: boolean; accepted: boolean };
    expect(body.ok).toBe(true);
    expect(body.accepted).toBe(true);
  });

  it("POST with missing Authorization returns 401 JSON", async () => {
    const res = await __test.handlers.POST(
      req("POST", {
        contentType: "application/json",
        body: { worklistId: "w1" },
      }),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("missing_authorization");
  });

  it("POST with malformed Authorization scheme returns 401 JSON", async () => {
    const res = await __test.handlers.POST(
      req("POST", {
        auth: "Token abc",
        contentType: "application/json",
        body: {},
      }),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("malformed_authorization");
  });

  it("POST with structurally invalid token returns 403 JSON", async () => {
    const res = await __test.handlers.POST(
      req("POST", {
        auth: "Bearer not-a-real-token",
        contentType: "application/json",
        body: {},
      }),
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_token");
  });

  it("POST honors ZONE_READER_INBOUND_TOKEN env when set", async () => {
    process.env.ZONE_READER_INBOUND_TOKEN = "server-side-secret";
    const bad = await __test.handlers.POST(
      req("POST", {
        auth: `Bearer ${validHex}`,
        contentType: "application/json",
        body: {},
      }),
    );
    expect(bad.status).toBe(403);
    const good = await __test.handlers.POST(
      req("POST", {
        auth: "Bearer server-side-secret",
        contentType: "application/json",
        body: {},
      }),
    );
    expect(good.status).toBe(202);
  });

  it("POST without JSON content-type returns 415", async () => {
    const res = await __test.handlers.POST(
      req("POST", { auth: `Bearer ${validHex}`, body: "raw" }),
    );
    expect(res.status).toBe(415);
  });

  it("POST with invalid JSON body returns 400", async () => {
    const res = await __test.handlers.POST(
      req("POST", {
        auth: `Bearer ${validHex}`,
        contentType: "application/json",
        body: "{not json",
      }),
    );
    expect(res.status).toBe(400);
  });
});
