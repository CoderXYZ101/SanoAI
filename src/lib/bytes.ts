/** Browser-safe byte helpers (no Node Buffer). */
export const utf8 = (u: Uint8Array): string => new TextDecoder("utf-8").decode(u);
export const toUtf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

export function toBase64(u: Uint8Array): string {
  let s = "";
  const step = 0x8000;
  for (let i = 0; i < u.length; i += step) s += String.fromCharCode(...u.subarray(i, i + step));
  return btoa(s);
}
export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}
export function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
export const latin1 = (u: Uint8Array): string => String.fromCharCode(...u);
