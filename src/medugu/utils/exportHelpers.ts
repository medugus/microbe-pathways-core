// Export helpers — pure utilities for FHIR/HL7 serialisation.
// Framework-agnostic. No React, no network.

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** HL7 v2 timestamp YYYYMMDDHHMMSS from ISO. */
export function hl7Ts(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return (
    `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}` +
    `${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}`
  );
}

/** Escape HL7 v2 field separators inside a value. */
export function hl7Escape(v: unknown): string {
  if (v === undefined || v === null) return "";
  return String(v)
    .replace(/\\/g, "\\E\\")
    .replace(/\|/g, "\\F\\")
    .replace(/\^/g, "\\S\\")
    .replace(/&/g, "\\T\\")
    .replace(/~/g, "\\R\\")
    .replace(/\r?\n/g, " ");
}

/** Build an HL7 segment from typed fields. */
export function hl7Segment(name: string, fields: (string | number | undefined | null)[]): string {
  const f = fields.map((v) => (v === undefined || v === null ? "" : String(v))).join("|");
  return `${name}|${f}`;
}

/** Trigger a client-side download of a string payload. No network. */
export function downloadText(filename: string, mime: string, content: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  return false;
}
