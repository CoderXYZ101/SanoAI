import { z } from "zod";
import { ApiError, authed, parseBody, rateLimit } from "@/client/http";
import { demoBilling, upiConfig } from "@/lib/billing";
import { myClaims, refId, submitClaim } from "@/lib/payments";

export const GET = authed(async (_req, { user }) => ({ claims: await myClaims(user.id), upi: upiConfig(), demo: demoBilling() }));

const Body = z.object({
  item: z.enum(["plus", "pro", "report"]),
  period: z.enum(["month", "year"]).default("month"),
  method: z.enum(["upi", "razorpay", "bank"]).default("upi"),
  reference: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{7,39}$/, "Enter the transaction reference (UTR) — 8 to 40 letters or digits, no spaces"),
});

/** The user reports a payment. It stays "pending" until an admin has checked that the money actually arrived. */
export const POST = authed(async (req, { user }) => {
  if (!rateLimit(`pay:${user.id}`, 5, 10 * 60_000)) throw new ApiError(429, "Too many submissions. Please wait a few minutes.");
  const b = await parseBody(req, Body);
  const mine = await myClaims(user.id);
  if (mine.filter((c) => c.status === "pending").length >= 3) throw new ApiError(409, "You already have 3 payments waiting for review.");
  if (mine.some((c) => c.status !== "rejected" && refId(c.reference) === refId(b.reference))) throw new ApiError(409, "You have already submitted this reference.");
  return { id: await submitClaim(user, b) };
});
