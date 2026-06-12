import { describe, expect, it } from "vitest";
import { buildZoneReaderCaptureUrl } from "../windowTransfer";

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
});
