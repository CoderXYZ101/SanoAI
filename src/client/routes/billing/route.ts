import { z } from "zod";
import { ApiError, authed, parseBody } from "@/client/http";
import { managedAiUrl } from "@/lib/aiKeys";
import { aiAllowance, checkoutLink, demoBilling, getEntitlements, PLANS, reportCredits } from "@/lib/billing";
import { getUser, updateUserProfile } from "@/lib/repo";

export const GET = authed(async (_req, { user }) => {
  const ent = await getEntitlements(user.id);
  const row = await getUser(user.id);
  const ai = await aiAllowance(user.id);
  const flags = (period: "month" | "year") => ({ plus: Boolean(checkoutLink("plus", period)), pro: Boolean(checkoutLink("pro", period)) });
  return {
    plan: ent.plan,
    planUntil: row?.plan_until ?? null,
    limits: { ...ent.limits, managedAiCalls: ai.limit },
    usage: { managedAi: ai.used },
    plans: PLANS,
    credits: await reportCredits(user.id),
    demoBilling: demoBilling(),
    managedAiAvailable: Boolean(managedAiUrl()),
    checkout: { month: flags("month"), year: flags("year"), report: Boolean(checkoutLink("report")) },
  };
});

/** Returns the Razorpay payment page for an item (UPI, cards, netbanking). The webhook matches the payer by email. */
export const POST = authed(async (req, { user }) => {
  const { item, period } = await parseBody(req, z.object({ item: z.enum(["plus", "pro", "report"]), period: z.enum(["month", "year"]).default("month") }));
  const link = checkoutLink(item, period);
  if (!link) throw new ApiError(400, "Online checkout is not configured for this deployment.");
  const u = new URL(link);
  u.searchParams.set("email", user.email); // prefill; the buyer must pay with their SanoAI email
  return { url: u.toString() };
});

/** DEMO ONLY (NEXT_PUBLIC_DEMO_BILLING=true): switch plan or add a report credit without paying. */
export const PUT = authed(async (req, { user }) => {
  if (!demoBilling()) throw new ApiError(403, "Demo billing is disabled.");
  const b = await parseBody(req, z.object({ plan: z.enum(["free", "plus", "pro"]).optional(), addCredit: z.boolean().optional() }));
  if (b.plan) await updateUserProfile(user.id, { demo_plan: b.plan });
  if (b.addCredit) await updateUserProfile(user.id, { demo_credits: Number((await getUser(user.id))?.demo_credits ?? 0) + 1 });
  return { ok: true };
});
