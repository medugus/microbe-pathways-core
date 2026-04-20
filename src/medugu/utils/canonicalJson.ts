// Deterministic JSON canonicalization for cryptographic seals.
//
// Postgres JSONB does not preserve key insertion order, so a naive
// `JSON.stringify(body)` on the round-tripped body produces a different
// string than the one we hashed at seal time. To make the SHA-256 seal
// reproducible from the stored body, both the server (when sealing) and
// the client (when verifying) must serialize using the same canonical
// form: recursively sort object keys, leave arrays in their original
// order, and use no extra whitespace.

export function canonicalStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(value as Record<string, unknown>).sort()) {
    sorted[k] = canonicalize((value as Record<string, unknown>)[k]);
  }
  return sorted;
}
