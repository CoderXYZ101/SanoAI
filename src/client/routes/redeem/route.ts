import { doc, getDoc, writeBatch } from "firebase/firestore";
import { z } from "zod";
import { ApiError, authed, parseBody, rateLimit } from "@/client/http";
import { PLAN_BY_ID } from "@/lib/billing";
import { fbDb } from "@/lib/firebase";
import { now } from "@/lib/repo";

/**
 * Sponsor codes: a lab, clinic or employer buys access and hands out codes. Redemption is one atomic batch that
 * Firestore rules verify (unused code, plan and expiry copied exactly), so no server is needed.
 */
export const POST = authed(async (req, { user }) => {
  if (!rateLimit(`redeem:${user.id}`, 6, 10 * 60_000)) throw new ApiError(429, "Too many attempts. Please wait a few minutes.");
  const { code } = await parseBody(req, z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{6,32}$/, "That does not look like a sponsor code") }));
  const codeRef = doc(fbDb(), "sano_codes", code);
  const snap = await getDoc(codeRef);
  const c = snap.data() as { plan?: "plus" | "pro"; valid_until?: string; redeemed_by?: string | null; sponsor?: string } | undefined;
  if (!c || !c.plan || !c.valid_until) throw new ApiError(404, "This code was not found.");
  if (c.redeemed_by) throw new ApiError(409, "This code has already been used.");
  if (new Date(c.valid_until).getTime() < Date.now()) throw new ApiError(410, "This code has expired.");
  const batch = writeBatch(fbDb());
  batch.update(codeRef, { redeemed_by: user.id, redeemed_at: now() });
  batch.update(doc(fbDb(), "sano_users", user.id), { plan: c.plan, plan_until: c.valid_until, redeemed_code: code });
  await batch.commit();
  return { plan: c.plan, name: PLAN_BY_ID[c.plan].name, until: c.valid_until, sponsor: c.sponsor ?? null };
});
