import { now, getUser } from "./repo";
import { store } from "./store";

/**
 * Plans, entitlements and usage metering.
 *
 * HOW PLANS ARE ACTIVATED
 *  - Production: a payment webhook (billing/razorpay-webhook-worker) writes `plan` / `plan_until` on the user's
 *    Firestore profile using admin credentials. Firestore security rules make those fields READ-ONLY for clients,
 *    so a user cannot upgrade themselves.
 *  - Demo: with NEXT_PUBLIC_DEMO_BILLING=true users can switch plans without paying (clearly labelled "demo"),
 *    stored in `demo_plan`, which is only honoured while that flag is on.
 *
 * Limits below are enforced in the app UI. A determined user could bypass UI checks in a static app, which is why
 * the revenue-critical resource (managed AI) is metered by the proxy server-side (billing/managed-ai-worker).
 */
export type PlanId = "free" | "plus" | "pro";

export interface PlanLimits {
  documents: number; // stored documents
  managedAiCalls: number; // per month, through SanoAI's AI proxy. KEEP IN SYNC with billing/managed-ai-worker
  conversations: number; // saved assistant conversations (-1 = unlimited)
  shareLinks: number; // active doctor share links
  logDays: number; // health-diary history kept visible (-1 = unlimited)
}
export interface PlanDef {
  id: PlanId;
  name: string;
  price: string;
  period: string;
  /** Yearly price (about two months free). */
  yearPrice?: string;
  tagline: string;
  highlight?: boolean;
  limits: PlanLimits;
  features: string[];
}

export const PLANS: PlanDef[] = [
  {
    id: "free",
    name: "Free",
    price: "₹0",
    period: "forever",
    tagline: "Understand your records, fully offline-capable.",
    limits: { documents: 5, managedAiCalls: 100, conversations: 10, shareLinks: 1, logDays: 30 },
    features: ["Up to 5 documents", "Timeline, blind-spot, uncertainty & cross-specialty engines", "Deficiency finder & simulator", "100 SanoAI AI answers / month, no key needed", "1 secure doctor link", "30-day health diary"],
  },
  {
    id: "plus",
    name: "Sano Plus",
    price: "₹199",
    yearPrice: "₹1,999",
    period: "per month",
    tagline: "More AI answers and more room.",
    highlight: true,
    limits: { documents: 50, managedAiCalls: 500, conversations: -1, shareLinks: 5, logDays: 365 },
    features: ["Everything in Free", "500 AI answers / month", "Up to 50 documents", "Unlimited saved conversations", "5 secure doctor links", "1-year health diary & trends", "Clean, unbranded doctor brief"],
  },
  {
    id: "pro",
    name: "Sano Pro",
    price: "₹499",
    yearPrice: "₹4,999",
    period: "per month",
    tagline: "For people managing complex or long-term care.",
    limits: { documents: 500, managedAiCalls: 1500, conversations: -1, shareLinks: 25, logDays: -1 },
    features: ["Everything in Plus", "1,500 AI answers / month", "Up to 500 documents", "25 secure doctor links", "Unlimited diary history", "Priority access to new modules"],
  },
];
export const PLAN_BY_ID = Object.fromEntries(PLANS.map((p) => [p.id, p])) as Record<PlanId, PlanDef>;

export const demoBilling = () => process.env.NEXT_PUBLIC_DEMO_BILLING === "true";
export type BillingPeriod = "month" | "year";
export const REPORT_PASS = { price: "₹99", name: "Premium Doctor Report" };
export type PayItem = "plus" | "pro" | "report";
/** Rupee amounts used for UPI payments and admin verification (keep in step with the display prices below). */
export const AMOUNTS: Record<PayItem, Record<BillingPeriod, number>> = {
  plus: { month: 199, year: 1999 },
  pro: { month: 499, year: 4999 },
  report: { month: 99, year: 99 },
};
/** Your UPI ID for direct payments. Public by nature. Never show a made-up one: someone could pay a stranger. */
export const upiConfig = () => ({ id: process.env.NEXT_PUBLIC_UPI_ID || "", name: process.env.NEXT_PUBLIC_UPI_NAME || "SanoAI" });
/** Razorpay Payment Page per item (public URLs, set at build time). */
export function checkoutLink(item: PlanId | "report", period: BillingPeriod = "month"): string {
  if (item === "report") return process.env.NEXT_PUBLIC_RAZORPAY_LINK_REPORT || "";
  if (item === "plus") return (period === "year" ? process.env.NEXT_PUBLIC_RAZORPAY_LINK_PLUS_YEAR : process.env.NEXT_PUBLIC_RAZORPAY_LINK_PLUS) || "";
  if (item === "pro") return (period === "year" ? process.env.NEXT_PUBLIC_RAZORPAY_LINK_PRO_YEAR : process.env.NEXT_PUBLIC_RAZORPAY_LINK_PRO) || "";
  return "";
}

/** One-off report credits. Paid credits are added only by the webhook; users can only spend them (see rules). */
export async function reportCredits(userId: string): Promise<{ paid: number; demo: number }> {
  const u = await getUser(userId).catch(() => undefined);
  return { paid: Number(u?.report_credits ?? 0), demo: demoBilling() ? Number(u?.demo_credits ?? 0) : 0 };
}

export async function getPlan(userId: string): Promise<PlanId> {
  const u = await getUser(userId).catch(() => undefined);
  if (!u) return "free";
  const expired = u.plan_until && new Date(u.plan_until).getTime() < Date.now();
  let plan: PlanId = !expired && (u.plan === "plus" || u.plan === "pro") ? u.plan : "free";
  if (plan === "free" && demoBilling() && (u.demo_plan === "plus" || u.demo_plan === "pro")) plan = u.demo_plan;
  return plan;
}
export async function getEntitlements(userId: string) {
  const plan = await getPlan(userId);
  return { plan, def: PLAN_BY_ID[plan], limits: PLAN_BY_ID[plan].limits };
}

// ───────────────────────── usage metering ─────────────────────────
const month = () => new Date().toISOString().slice(0, 7);
const usageId = (userId: string) => `${userId}_${month()}`;

export async function getUsage(userId: string): Promise<{ managedAi: number }> {
  const r = await store.get("usage", usageId(userId));
  return { managedAi: Number(r?.managed_ai ?? 0) };
}
// Only the AI proxy counts usage. The proxy honours real plans only (never demo plans), so the app does the same.
export async function aiAllowance(userId: string): Promise<{ used: number; limit: number; left: number }> {
  const u = await getUser(userId).catch(() => undefined);
  const active = u && (u.plan === "plus" || u.plan === "pro") && !(u.plan_until && new Date(u.plan_until).getTime() < Date.now());
  const limit = PLAN_BY_ID[active ? u.plan : "free"].limits.managedAiCalls;
  const used = (await getUsage(userId)).managedAi;
  return { used: Math.min(used, limit), limit, left: Math.max(0, limit - used) };
}

/** Throws a user-facing error when a plan limit would be exceeded. */
export class PlanLimitError extends Error {
  constructor(
    message: string,
    public readonly needed: PlanId,
  ) {
    super(message);
  }
}
export async function assertWithin(userId: string, what: "documents" | "shareLinks" | "conversations", current: number) {
  const { plan, limits } = await getEntitlements(userId);
  const max = limits[what];
  if (max >= 0 && current >= max) {
    const next: PlanId = plan === "free" ? "plus" : "pro";
    const label = what === "documents" ? "documents" : what === "shareLinks" ? "secure doctor links" : "saved conversations";
    throw new PlanLimitError(`Your ${PLAN_BY_ID[plan].name} plan includes up to ${max} ${label}. Upgrade to ${PLAN_BY_ID[next].name} for more.`, next);
  }
}
