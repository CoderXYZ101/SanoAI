/** RFC4122 v4 id using the Web Crypto API (works in browsers and Node 19+). */
export const uuid = (): string => globalThis.crypto.randomUUID();
