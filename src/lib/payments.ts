import { collection, doc, getDocs, increment, runTransaction, writeBatch, query } from "firebase/firestore";
import { AMOUNTS, type BillingPeriod, type PayItem } from "./billing";
import { fbDb } from "./firebase";
import { now } from "./repo";
import { store } from "./store";
import { uuid } from "./uuid";

/**
 * Manual payment verification (UPI / bank / Razorpay reference).
 *  user pays → submits the transaction reference → an ADMIN checks it in the bank / UPI / Razorpay app → approves.
 * Firestore rules guarantee: users can only create "pending" claims for themselves; only admins can decide them or
 * change plans; and each transaction reference can be approved only once.
 */
export interface PaymentClaim {
  id: string;
  user_id: string;
  email: string;
  item: PayItem;
  period: BillingPeriod;
  amount: number;
  method: "upi" | "razorpay" | "bank";
  reference: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  note?: string;
  reviewed_at?: string;
  reviewed_by?: string;
}

/** An account is an admin when a document sano_admins/{uid} exists (created by the owner in the Firebase console). */
export async function isAdmin(userId: string): Promise<boolean> {
  return Boolean(await store.get("admins", userId));
}

export async function myClaims(userId: string): Promise<PaymentClaim[]> {
  const rows = (await store.where("payments", { user_id: userId })) as unknown as PaymentClaim[];
  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function submitClaim(user: { id: string; email: string }, c: { item: PayItem; period: BillingPeriod; method: PaymentClaim["method"]; reference: string }): Promise<string> {
  const id = uuid();
  const claim: PaymentClaim = { id, user_id: user.id, email: user.email, item: c.item, period: c.period, amount: AMOUNTS[c.item][c.period], method: c.method, reference: c.reference, status: "pending", created_at: now() };
  await store.set("payments", claim);
  return id;
}

// ───────────────────────── admin ─────────────────────────
export interface AdminUser {
  plan: string;
  plan_until: string | null;
  name: string;
}
export async function allClaims() {
  const rows = (await store.where("payments", {})) as unknown as PaymentClaim[];
  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const pending = rows.filter((r) => r.status === "pending");
  const info = await Promise.all(
    pending.map(async (p) => {
      const [u, used] = await Promise.all([store.get("users", p.user_id), store.get("payment_refs", refId(p.reference))]);
      return { ...p, user: u ? ({ plan: String(u.plan), plan_until: (u.plan_until as string | null) ?? null, name: String(u.name) } satisfies AdminUser) : null, referenceUsed: Boolean(used) };
    }),
  );
  return { pending: info, history: rows.filter((r) => r.status !== "pending").slice(0, 50) };
}

/** One document per approved reference; normalised so spacing / capitals cannot be used to approve the same UTR twice. */
export const refId = (reference: string) => reference.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

export async function approveClaim(adminId: string, claimId: string): Promise<void> {
  const db = fbDb();
  await runTransaction(db, async (tx) => {
    const claimRef = doc(db, "sano_payments", claimId);
    const claim = (await tx.get(claimRef)).data() as PaymentClaim | undefined;
    if (!claim || claim.status !== "pending") throw new Error("This claim has already been handled.");
    const usedRef = doc(db, "sano_payment_refs", refId(claim.reference));
    if ((await tx.get(usedRef)).exists()) throw new Error("This transaction reference was already used for another approval.");
    const userRef = doc(db, "sano_users", claim.user_id);
    const user = (await tx.get(userRef)).data();
    if (!user) throw new Error("That user account no longer exists.");

    if (claim.item === "report") {
      tx.update(userRef, { report_credits: increment(1), last_payment_id: claim.reference });
    } else {
      // renewing the same plan extends it; otherwise access starts today
      const current = user.plan === claim.item && user.plan_until ? new Date(String(user.plan_until)).getTime() : 0;
      const start = Math.max(Date.now(), current);
      const days = claim.period === "year" ? 366 : 31;
      tx.update(userRef, { plan: claim.item, plan_until: new Date(start + days * 86_400_000).toISOString(), last_payment_id: claim.reference });
    }
    tx.set(usedRef, { id: usedRef.id, claim_id: claimId, user_id: claim.user_id, approved_at: now() });
    tx.update(claimRef, { status: "approved", reviewed_at: now(), reviewed_by: adminId });
  });
}

export async function rejectClaim(adminId: string, claimId: string, note: string): Promise<void> {
  const db = fbDb();
  const batch = writeBatch(db);
  batch.update(doc(db, "sano_payments", claimId), { status: "rejected", note, reviewed_at: now(), reviewed_by: adminId });
  await batch.commit();
}

export async function adminLists() {
  const read = async (c: string) => (await getDocs(query(collection(fbDb(), c)))).docs.map((d) => ({ ...d.data(), id: d.id }) as Record<string, unknown> & { id: string });
  const [leads, codes] = await Promise.all([read("sano_leads"), read("sano_codes")]);
  const t = (r: Record<string, unknown>) => String(r.created_at ?? "");
  return { leads: leads.sort((a, b) => t(b).localeCompare(t(a))), codes: codes.sort((a, b) => t(b).localeCompare(t(a))) };
}

const ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => "SANO-" + Array.from(globalThis.crypto.getRandomValues(new Uint8Array(10)), (b) => ABC[b % ABC.length]).join("");

export async function createCodes(o: { count: number; plan: "plus" | "pro"; validUntil: string; sponsor: string }): Promise<string[]> {
  const db = fbDb();
  const batch = writeBatch(db);
  const codes = Array.from({ length: o.count }, newCode);
  const valid = new Date(`${o.validUntil}T23:59:59+05:30`).toISOString();
  for (const code of codes) batch.set(doc(db, "sano_codes", code), { plan: o.plan, valid_until: valid, redeemed_by: null, sponsor: o.sponsor, created_at: now() });
  await batch.commit();
  return codes;
}
