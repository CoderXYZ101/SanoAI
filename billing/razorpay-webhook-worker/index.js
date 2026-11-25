/**
 * SanoAI billing webhook (India) — Razorpay → Cloudflare Worker (free tier) → Firestore.
 * TEMPLATE: not deployed or tested against live Razorpay.
 *
 * Flow: user pays on a Razorpay Payment Page (UPI / card / netbanking) using their SanoAI email → Razorpay calls
 * this Worker → the signature is verified → `plan` / `plan_until` are written on that user's Firestore profile with
 * admin credentials (clients cannot edit those fields).
 *
 * Secrets: RAZORPAY_WEBHOOK_SECRET, GCP_SERVICE_ACCOUNT (service-account JSON)
 * Vars:    FIREBASE_PROJECT_ID, PRICE_PLUS_PAISE (19900), PRICE_PRO_PAISE (49900),
 *          PRICE_PLUS_YEAR_PAISE (199900), PRICE_PRO_YEAR_PAISE (499900), PRICE_REPORT_PAISE (9900)
 * Webhook events: payment.captured
 * Note: Firebase emails are not verified by default — enable email verification before going live.
 */
const enc = new TextEncoder();
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function hmacHex(body, secret) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function googleAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claim = b64url(enc.encode(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/datastore", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(`${header}.${claim}`));
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${header}.${claim}.${b64url(sig)}` });
  return (await r.json()).access_token;
}

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("ok");
    const body = await request.text();
    const expected = await hmacHex(body, env.RAZORPAY_WEBHOOK_SECRET);
    if (expected !== request.headers.get("x-razorpay-signature")) return new Response("bad signature", { status: 400 });
    try {
      const event = JSON.parse(body);
      if (event.event !== "payment.captured") return new Response("ignored");
      const pay = event.payload.payment.entity;
      if (pay.currency !== "INR") return new Response("ignored");
      // amount (paise) → what was bought
      const catalogue = {
        [env.PRICE_PLUS_PAISE]: { plan: "plus", days: 31 },
        [env.PRICE_PRO_PAISE]: { plan: "pro", days: 31 },
        [env.PRICE_PLUS_YEAR_PAISE]: { plan: "plus", days: 366 },
        [env.PRICE_PRO_YEAR_PAISE]: { plan: "pro", days: 366 },
        [env.PRICE_REPORT_PAISE]: { credit: 1 },
      };
      const item = catalogue[String(pay.amount)];
      const email = String(pay.email || "").toLowerCase();
      if (!item || !email) return new Response("ignored");

      const token = await googleAccessToken(JSON.parse(env.GCP_SERVICE_ACCOUNT));
      const base = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
      const auth = { authorization: `Bearer ${token}`, "content-type": "application/json" };
      const found = await (
        await fetch(`${base}:runQuery`, { method: "POST", headers: auth, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "sano_users" }], where: { fieldFilter: { field: { fieldPath: "email" }, op: "EQUAL", value: { stringValue: email } } }, limit: 1 } }) })
      ).json();
      const user = found?.[0]?.document;
      const name = user?.name;
      if (!name) return new Response("no matching user", { status: 202 }); // reconcile manually
      if (user.fields?.last_payment_id?.stringValue === pay.id) return new Response("already applied"); // webhook retries

      const fields = item.credit
        ? { report_credits: { integerValue: String(Number(user.fields?.report_credits?.integerValue ?? 0) + item.credit) }, last_payment_id: { stringValue: pay.id } }
        : { plan: { stringValue: item.plan }, plan_until: { stringValue: new Date(Date.now() + item.days * 86_400_000).toISOString() }, last_payment_id: { stringValue: pay.id } };
      const mask = Object.keys(fields).map((f) => `updateMask.fieldPaths=${f}`).join("&");
      const r = await fetch(`https://firestore.googleapis.com/v1/${name}?${mask}`, { method: "PATCH", headers: auth, body: JSON.stringify({ fields }) });
      if (!r.ok) throw new Error(`Firestore ${r.status}`);
      return new Response("ok");
    } catch (e) {
      return new Response(String(e.message || e), { status: 500 }); // Razorpay retries
    }
  },
};
