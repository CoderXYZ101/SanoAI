import { aiStatus } from "@/ai/structured";
import { getProfile, getSettings, listDocuments, listEvents } from "./repo";

/** Everything an engine needs about ONE user, loaded with user-scoped queries. */
export async function loadUserContext(userId: string) {
  const [events, docs, profile, settings, ai] = await Promise.all([listEvents(userId), listDocuments(userId), getProfile(userId), getSettings(userId), aiStatus(userId)]);
  return { events, docs, profile, settings, ai };
}

/** Small non-cryptographic hash (cache keys only). */
export const hashOf = (v: unknown): string => {
  const s = JSON.stringify(v);
  let h1 = 0xdeadbeef ^ s.length;
  let h2 = 0x41c6ce57 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
};
