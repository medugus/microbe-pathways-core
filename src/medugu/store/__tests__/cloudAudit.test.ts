import { describe, expect, it, vi } from "vitest";
import {
  appendLocalAuditFallback,
  buildSignedAuditPayload,
  type LocalAuditFallbackEvent,
} from "../cloudAudit";

describe("cloud audit signing", () => {
  it("builds a deterministic signed payload hash", async () => {
    const first = await buildSignedAuditPayload(
      {
        action: "release.finalised",
        entity: "release_package",
        entityId: "acc-1:1",
        accessionId: "acc-1",
        newValue: { status: "released", version: 1 },
        sourceModule: "release",
      },
      {
        tenantId: "tenant-1",
        actorUserId: "user-1",
        actorLabel: "Consultant",
        at: "2026-04-25T10:00:00.000Z",
      },
    );
    const second = await buildSignedAuditPayload(
      {
        entityId: "acc-1:1",
        entity: "release_package",
        accessionId: "acc-1",
        sourceModule: "release",
        action: "release.finalised",
        newValue: { version: 1, status: "released" },
      },
      {
        tenantId: "tenant-1",
        actorUserId: "user-1",
        actorLabel: "Consultant",
        at: "2026-04-25T10:00:00.000Z",
      },
    );

    expect(first.payloadHash).toEqual(second.payloadHash);
    expect(first.payload.eventType).toEqual("release.finalised");
    expect(first.payload.accessionId).toEqual("acc-1");
    expect(first.payload.sourceModule).toEqual("release");
  });

  it("queues fallback events in localStorage without mutating older entries", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    });

    const event: LocalAuditFallbackEvent = {
      queuedAt: "2026-04-25T10:00:00.000Z",
      tenantId: "tenant-1",
      actorUserId: "user-1",
      reason: "network unavailable",
      payloadHash: "hash-1",
      payload: { action: "ams.approved" },
    };

    appendLocalAuditFallback(event);
    appendLocalAuditFallback({ ...event, payloadHash: "hash-2" });

    const raw = store.get("medugu:persistent-audit-fallback:v1");
    const rows = JSON.parse(raw ?? "[]") as LocalAuditFallbackEvent[];
    expect(rows.map((row) => row.payloadHash)).toEqual(["hash-1", "hash-2"]);

    vi.unstubAllGlobals();
  });
});
