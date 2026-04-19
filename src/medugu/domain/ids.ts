// Lightweight ID generation. Replace with ULID/UUID lib later if needed.

const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function rand(len: number): string {
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return out;
}

export function newAccessionId(): string {
  const yy = new Date().getFullYear().toString().slice(-2);
  return `MB${yy}-${rand(6)}`;
}

export function newId(prefix = "id"): string {
  return `${prefix}_${rand(10)}`;
}
