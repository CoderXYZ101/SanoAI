/**
 * Security-rules + payment-approval test against the local Firebase emulators.
 *   1) npm run emulators      2) npm run test:rules
 * Uses the real app code (src/lib/payments, src/lib/repo) with the client SDK, so rules are enforced.
 */
// static imports: the test must use the same Firebase module instance as the app code
import { createUserWithEmailAndPassword, GoogleAuthProvider, sendEmailVerification, signInWithCredential, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, terminate, updateDoc, writeBatch } from "firebase/firestore";
import { fbAuth, fbDb } from "../src/lib/firebase";
import * as pay from "../src/lib/payments";
import * as repo from "../src/lib/repo";
import { store } from "../src/lib/store";

process.env.NEXT_PUBLIC_USE_EMULATORS = "true";

const PROJECT = "demo-sanoai";
const AUTH = "http://127.0.0.1:9099";
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;

let passed = 0;
let failed = 0;
function report(name: string, ok: boolean, detail = "") {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}
async function allowed(name: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    report(name, true);
  } catch (e) {
    report(name, false, (e as Error).message);
  }
}
/** Passes only when the rules refused (code permission-denied), or, if given, the app's own message matches. */
async function denied(name: string, fn: () => Promise<unknown>, expect?: RegExp) {
  try {
    await fn();
    report(name, false, "was allowed");
  } catch (e) {
    const err = e as Error & { code?: string };
    report(name, expect ? expect.test(err.message) : err.code === "permission-denied", `${err.code} ${err.message}`);
  }
}

async function main() {
  const auth = fbAuth();
  const db = fbDb();
  const run = Date.now().toString(36);
  const password = `Test-${run}-Pass9`;

  async function makeUser(label: string) {
    const email = `${label}-${run}@example.test`;
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    return { email, uid: user.uid };
  }
  /** Click the verification link the emulator would have emailed. */
  async function verify() {
    const u = auth.currentUser!;
    await sendEmailVerification(u);
    const codes = (await (await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/oobCodes`)).json()) as { oobCodes: { email: string; requestType: string; oobLink: string }[] };
    const link = codes.oobCodes.filter((c) => c.email === u.email && c.requestType === "VERIFY_EMAIL").pop()!.oobLink;
    await fetch(link);
    await u.reload();
    await u.getIdToken(true);
  }
  const login = async (email: string) => {
    await signOut(auth);
    await signInWithEmailAndPassword(auth, email, password);
  };
  const profile = (uid: string, email: string) => ({ id: uid, user_id: uid, email, name: "Test", created_at: new Date().toISOString(), plan: "free", plan_until: null, report_credits: 0 });

  console.log("\nEmail verification");
  const alice = await makeUser("alice");
  await denied("unverified account cannot create a profile", () => store.set("users", profile(alice.uid, alice.email)));
  await denied("unverified account cannot write records", () => store.set("events", { id: `e-${run}`, user_id: alice.uid }));
  await verify();
  await denied("cannot create a profile with someone else's email", () => store.set("users", profile(alice.uid, "other@example.test")));
  await denied("cannot create a profile that starts on a paid plan", () => store.set("users", { ...profile(alice.uid, alice.email), plan: "pro" }));
  await allowed("verified account creates its profile", () => repo.createUser(alice.uid, alice.email, "Alice"));
  await allowed("verified account writes its own record", () => store.set("events", { id: `e-${run}`, user_id: alice.uid }));

  console.log("\nGoogle account");
  // the emulator accepts an unsigned Google token, so no real Google account is involved
  const gmail = `google-${run}@example.test`;
  const google = await signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: `g-${run}`, email: gmail, email_verified: true })));
  await allowed("Google sign-in creates a profile without a verification email", () => repo.createUser(google.user.uid, gmail, "Google User"));
  await login(alice.email);

  console.log("\nSelf-service limits");
  const me = () => doc(db, "sano_users", alice.uid);
  await denied("cannot upgrade own plan", () => updateDoc(me(), { plan: "pro" }));
  await denied("cannot add report credits", () => updateDoc(me(), { report_credits: 5 }));
  await denied("cannot change profile email", () => updateDoc(me(), { email: "victim@example.test" }));
  await allowed("can change own name", () => updateDoc(me(), { name: "Alice B" }));
  await denied("cannot make self admin", () => setDoc(doc(db, "sano_admins", alice.uid), { id: alice.uid, user_id: alice.uid }));
  await denied("cannot create sponsor codes", () => pay.createCodes({ count: 1, plan: "pro", validUntil: "2030-01-01", sponsor: "x" }));
  await denied("cannot list sponsor codes or enquiries", () => pay.adminLists());

  console.log("\nPayment claims");
  const ref = `UTR${run.toUpperCase()}001`;
  let claimId = "";
  await allowed("user submits a pending claim", async () => (claimId = await pay.submitClaim({ id: alice.uid, email: alice.email }, { item: "plus", period: "month", method: "upi", reference: ref })));
  await allowed("user reads own claims", async () => {
    if ((await pay.myClaims(alice.uid)).length !== 1) throw new Error("claim missing");
  });
  const base = { id: `c-${run}`, user_id: alice.uid, email: alice.email, item: "pro", period: "year", amount: 4999, method: "upi", reference: `UTR${run}002`, status: "pending", created_at: new Date().toISOString() };
  await denied("cannot create an already-approved claim", () => store.set("payments", { ...base, status: "approved" }));
  await denied("cannot claim under another email", () => store.set("payments", { ...base, email: "victim@example.test" }));
  await denied("cannot spoof the claim id", () => setDoc(doc(db, "sano_payments", `d-${run}`), { ...base, id: claimId }));
  await denied("cannot submit a blank-looking reference", () => store.set("payments", { ...base, reference: "--------" }));
  await denied("cannot add extra fields to a claim", () => store.set("payments", { ...base, note: "verified" }));
  await denied("cannot approve own claim", () => pay.approveClaim(alice.uid, claimId));
  await denied("cannot edit a submitted claim", () => updateDoc(doc(db, "sano_payments", claimId), { amount: 1 }));

  console.log("\nOther users");
  const bob = await makeUser("bob");
  await verify();
  await repo.createUser(bob.uid, bob.email, "Bob");
  await denied("cannot read another user's profile", () => store.get("users", alice.uid));
  await denied("cannot read another user's claim", () => store.get("payments", claimId));
  await denied("cannot list all claims", () => pay.allClaims());
  await denied("cannot read another user's record", () => store.get("events", `e-${run}`));

  console.log("\nAdministrator");
  const admin = await makeUser("admin");
  await verify();
  await repo.createUser(admin.uid, admin.email, "Admin");
  // what the project owner does by hand in the Firebase console ("Bearer owner" is emulator-only)
  const made = await fetch(`${FS}/sano_admins?documentId=${admin.uid}`, { method: "POST", headers: { Authorization: "Bearer owner", "Content-Type": "application/json" }, body: JSON.stringify({ fields: { role: { stringValue: "owner" } } }) });
  report("owner adds an admin document", made.ok, String(made.status));
  await allowed("admin is recognised", async () => {
    if (!(await pay.isAdmin(admin.uid))) throw new Error("not admin");
  });
  await denied("admin cannot read a user's medical records", () => store.get("events", `e-${run}`));
  await denied("admin cannot change a user's name", () => updateDoc(doc(db, "sano_users", alice.uid), { name: "x" }));
  await allowed("admin sees the pending claim", async () => {
    if (!(await pay.allClaims()).pending.some((c) => c.id === claimId)) throw new Error("not listed");
  });
  await allowed("admin approves the claim", () => pay.approveClaim(admin.uid, claimId));
  await allowed("plan is active for about a month", async () => {
    const u = (await store.get("users", alice.uid))!;
    const days = (new Date(String(u.plan_until)).getTime() - Date.now()) / 86_400_000;
    if (u.plan !== "plus" || days < 30 || days > 31.1) throw new Error(`${u.plan} ${days}`);
  });
  await denied("same claim cannot be approved twice", () => pay.approveClaim(admin.uid, claimId), /already been handled/);

  await login(bob.email);
  const reuse = await pay.submitClaim({ id: bob.uid, email: bob.email }, { item: "report", period: "month", method: "upi", reference: ref.toLowerCase() });
  const second = await pay.submitClaim({ id: bob.uid, email: bob.email }, { item: "report", period: "month", method: "upi", reference: `UTR${run}003` });
  await login(admin.email);
  await denied("a used reference cannot be approved again", () => pay.approveClaim(admin.uid, reuse), /already used/);
  await allowed("admin rejects with a reason", () => pay.rejectClaim(admin.uid, reuse, "Reference already used"));
  await denied("rejected claim cannot be reopened", () => pay.approveClaim(admin.uid, reuse), /already been handled/);
  await allowed("admin approves a report pass", () => pay.approveClaim(admin.uid, second));
  await allowed("report credit added", async () => {
    if ((await store.get("users", bob.uid))!.report_credits !== 1) throw new Error("no credit");
  });
  let code = "";
  await allowed("admin creates sponsor codes", async () => ([code] = await pay.createCodes({ count: 2, plan: "pro", validUntil: "2030-01-01", sponsor: "Test Lab" })));
  await allowed("admin lists codes and enquiries", () => pay.adminLists());

  console.log("\nSponsor code + enquiry");
  await login(bob.email);
  await allowed("user can look up a code", async () => {
    if (!(await getDoc(doc(db, "sano_codes", code))).exists()) throw new Error("missing");
  });
  await allowed("profile stays editable after an admin approval", () => repo.updateUserProfile(bob.uid, { name: "Bob B" }));
  await allowed("user spends the report credit", () => repo.updateUserProfile(bob.uid, { report_credits: 0 }));
  const redeem = (plan: string) => {
    const batch = writeBatch(db);
    batch.update(doc(db, "sano_codes", code), { redeemed_by: bob.uid, redeemed_at: new Date().toISOString() });
    batch.update(doc(db, "sano_users", bob.uid), { plan, plan_until: new Date("2030-01-01T23:59:59+05:30").toISOString(), redeemed_code: code });
    return batch.commit();
  };
  await denied("cannot redeem a code for a different plan", () => redeem("plus"));
  await allowed("user redeems a sponsor code", () => redeem("pro"));
  await denied("a redeemed code cannot be claimed again", () => redeem("pro"));
  await login(alice.email);
  await allowed("account deletion removes profile, records and claims", async () => {
    await repo.deleteAccount(alice.uid);
    if (await store.get("users", alice.uid)) throw new Error("profile remains");
  });
  await signOut(auth);
  const lead = { id: `l-${run}`, org: "Lab", type: "Diagnostic lab", name: "N", contact: "n@example.test", volume: "", message: "", created_at: new Date().toISOString() };
  await allowed("visitor can send a business enquiry", () => store.set("leads", lead));
  await denied("visitor cannot send a malformed enquiry", () => store.set("leads", { ...lead, id: `m-${run}`, type: { bad: true } }));
  await denied("visitor cannot read enquiries", () => store.get("leads", lead.id));

  console.log(`\n${passed}/${passed + failed} security checks passed`);
  await terminate(db);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
