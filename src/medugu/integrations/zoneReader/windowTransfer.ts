import type { ZoneReaderWorklistExport } from "./types";

export const ZONE_READER_READY_MESSAGE = "ZONE_READER_READY";
export const ZONE_READER_WORKLIST_MESSAGE = "MEDUGU_ZONE_READER_WORKLIST";
export const ZONE_READER_ACCEPTED_MESSAGE = "ZONE_READER_WORKLIST_ACCEPTED";
export const ZONE_READER_REJECTED_MESSAGE = "ZONE_READER_WORKLIST_REJECTED";
export const ZONE_READER_RESULT_MESSAGE = "ZONE_READER_RESULT";
export const ZONE_READER_RESULT_ACCEPTED_MESSAGE = "ZONE_READER_RESULT_ACCEPTED";
export const ZONE_READER_RESULT_REJECTED_MESSAGE = "ZONE_READER_RESULT_REJECTED";

const registeredReaderWindows = new Set<Window>();

type TransferReply = {
  type?: string;
  transferId?: string;
  worklistId?: string;
  message?: string;
  payload?: unknown;
};

export type ZoneReaderTransferResult = {
  worklistId: string;
};

export function buildZoneReaderCaptureUrl(appUrl: string) {
  const url = new URL(appUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Zone Reader app URL must use http:// or https://.");
  }

  const basePath = url.pathname.replace(/\/+$/, "");
  url.pathname = (basePath.endsWith("/capture")
    ? basePath
    : `${basePath}/capture`
  ).replace(/\/{2,}/g, "/");
  url.search = "";
  url.hash = "";
  return { url: url.toString(), origin: url.origin };
}

export function sendWorklistToZoneReader({
  appUrl,
  worklist,
  timeoutMs = 15_000,
}: {
  appUrl: string;
  worklist: ZoneReaderWorklistExport;
  timeoutMs?: number;
}): Promise<ZoneReaderTransferResult> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Zone Reader transfer requires a browser window."));
  }

  const target = buildZoneReaderCaptureUrl(appUrl);
  const transferId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `zone-reader-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return new Promise((resolve, reject) => {
    let readerWindow: Window | null = null;
    let retryTimer: number | undefined;
    let timeoutTimer: number | undefined;

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (retryTimer !== undefined) window.clearInterval(retryTimer);
      if (timeoutTimer !== undefined) window.clearTimeout(timeoutTimer);
    };

    const sendPayload = () => {
      if (!readerWindow || readerWindow.closed) return;
      readerWindow.postMessage(
        {
          type: ZONE_READER_WORKLIST_MESSAGE,
          transferId,
          payload: worklist,
        },
        target.origin,
      );
    };

    const onMessage = (event: MessageEvent<TransferReply>) => {
      if (
        !readerWindow ||
        event.source !== readerWindow ||
        event.origin !== target.origin
      ) {
        return;
      }

      if (event.data?.type === ZONE_READER_READY_MESSAGE) {
        sendPayload();
        return;
      }

      if (event.data?.transferId !== transferId) return;

      if (event.data.type === ZONE_READER_ACCEPTED_MESSAGE) {
        cleanup();
        resolve({ worklistId: event.data.worklistId ?? worklist.worklistId });
        return;
      }

      if (event.data.type === ZONE_READER_REJECTED_MESSAGE) {
        cleanup();
        reject(
          new Error(
            event.data.message || "Zone Reader rejected the selected worklist.",
          ),
        );
      }
    };

    window.addEventListener("message", onMessage);
    readerWindow = window.open(target.url, "medugu-zone-reader");

    if (!readerWindow) {
      cleanup();
      reject(
        new Error(
          "The browser blocked the Zone Reader window. Allow pop-ups and try again.",
        ),
      );
      return;
    }

    registeredReaderWindows.add(readerWindow);
    retryTimer = window.setInterval(sendPayload, 1_000);
    timeoutTimer = window.setTimeout(() => {
      cleanup();
      reject(
        new Error(
          "Zone Reader did not acknowledge the worklist. Use Download JSON as the fallback.",
        ),
      );
    }, timeoutMs);
  });
}


export function installZoneReaderResultReceiver({
  appUrl,
  onResult,
}: {
  appUrl: string;
  onResult: (payload: unknown) => void | Promise<void>;
}) {
  if (typeof window === "undefined") return () => {};

  const target = buildZoneReaderCaptureUrl(appUrl);

  const onMessage = async (event: MessageEvent<TransferReply>) => {
    const source = event.source as Window | null;
    if (
      !source ||
      !registeredReaderWindows.has(source) ||
      event.origin !== target.origin ||
      event.data?.type !== ZONE_READER_RESULT_MESSAGE ||
      !event.data.transferId
    ) {
      return;
    }

    try {
      await onResult(event.data.payload);
      source.postMessage(
        {
          type: ZONE_READER_RESULT_ACCEPTED_MESSAGE,
          transferId: event.data.transferId,
          message:
            "Result received in Medugu LIMS and loaded for clinical review.",
        },
        target.origin,
      );
      registeredReaderWindows.delete(source);
    } catch (error) {
      source.postMessage(
        {
          type: ZONE_READER_RESULT_REJECTED_MESSAGE,
          transferId: event.data.transferId,
          message: error instanceof Error ? error.message : String(error),
        },
        target.origin,
      );
    }
  };

  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}
