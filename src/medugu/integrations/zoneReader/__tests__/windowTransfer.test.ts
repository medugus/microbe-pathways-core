import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildZoneReaderCaptureUrl,
  installZoneReaderResultReceiver,
  sendWorklistToZoneReader,
  ZONE_READER_ACCEPTED_MESSAGE,
  ZONE_READER_READY_MESSAGE,
  ZONE_READER_RESULT_ACCEPTED_MESSAGE,
  ZONE_READER_RESULT_MESSAGE,
} from "../windowTransfer";

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});

describe("Zone Reader worklist window transfer", () => {
  it("targets the capture route on a configured app origin", () => {
    expect(buildZoneReaderCaptureUrl("https://reader.example.test/")).toEqual({
      url: "https://reader.example.test/capture",
      origin: "https://reader.example.test",
    });
  });

  it("preserves deployment subpaths and avoids duplicate capture segments", () => {
    expect(buildZoneReaderCaptureUrl("https://reader.example.test/lab")).toEqual({
      url: "https://reader.example.test/lab/capture",
      origin: "https://reader.example.test",
    });
    expect(buildZoneReaderCaptureUrl("https://reader.example.test/capture")).toEqual({
      url: "https://reader.example.test/capture",
      origin: "https://reader.example.test",
    });
  });

  it("accepts a result only from the reader window opened for the worklist", async () => {
    const listeners = new Set<(event: MessageEvent) => void>();
    const readerWindow = {
      closed: false,
      postMessage: vi.fn(),
    };
    Object.defineProperty(globalThis, "window", {
      value: {
        addEventListener: vi.fn(
          (type: string, listener: (event: MessageEvent) => void) => {
            if (type === "message") listeners.add(listener);
          },
        ),
        removeEventListener: vi.fn(
          (type: string, listener: (event: MessageEvent) => void) => {
            if (type === "message") listeners.delete(listener);
          },
        ),
        open: vi.fn(() => readerWindow),
        setInterval,
        clearInterval,
        setTimeout,
        clearTimeout,
      },
      configurable: true,
    });

    const worklist = {
      schemaVersion: "1.0.0" as const,
      sourceSystem: "MEDUGU_LIMS" as const,
      createdAt: "2026-06-12T12:00:00.000Z",
      worklistId: "worklist-1",
      accessionId: "acc-1",
      accessionNumber: "ACC-001",
      isolateId: "iso-1",
      patientDisplayId: "P-001",
      specimenType: "Urine",
      organismName: "Escherichia coli",
      organismCode: "ECOL",
      organismGroup: "Enterobacterales",
      astPanelId: "panel-1",
      astPanelName: "Urine panel",
      standard: "EUCAST" as const,
      expectedDiscs: [
        {
          antibioticCode: "AMP",
          antibioticName: "Ampicillin",
          discPotency: "10 ug",
        },
      ],
    };

    const transfer = sendWorklistToZoneReader({
      appUrl: "https://reader.example.test/",
      worklist,
    });
    const transferListener = [...listeners][0];
    expect(transferListener).toBeDefined();

    transferListener!({
      source: readerWindow,
      origin: "https://reader.example.test",
      data: { type: ZONE_READER_READY_MESSAGE },
    } as unknown as MessageEvent);

    const worklistMessage = readerWindow.postMessage.mock.calls.find(
      ([message]: [{ type: string; transferId: string }]) => message.type === "MEDUGU_ZONE_READER_WORKLIST",
    )?.[0];
    expect(worklistMessage).toBeDefined();
    transferListener!({
      source: readerWindow,
      origin: "https://reader.example.test",
      data: {
        type: ZONE_READER_ACCEPTED_MESSAGE,
        transferId: worklistMessage!.transferId,
        worklistId: worklist.worklistId,
      },
    } as unknown as MessageEvent);
    await transfer;

    const onResult = vi.fn();
    const uninstall = installZoneReaderResultReceiver({
      appUrl: "https://reader.example.test/",
      onResult,
    });
    const resultListener = [...listeners][0];
    expect(resultListener).toBeDefined();
    await resultListener!({
      source: readerWindow,
      origin: "https://reader.example.test",
      data: {
        type: ZONE_READER_RESULT_MESSAGE,
        transferId: "result-1",
        payload: { accessionId: "acc-1", results: [] },
      },
    } as unknown as MessageEvent);

    expect(onResult).toHaveBeenCalledWith({
      accessionId: "acc-1",
      results: [],
    });
    expect(readerWindow.postMessage).toHaveBeenLastCalledWith(
      {
        type: ZONE_READER_RESULT_ACCEPTED_MESSAGE,
        transferId: "result-1",
        message: "Result received in Medugu LIMS and loaded for clinical review.",
      },
      "https://reader.example.test",
    );
    uninstall();
  });
});
