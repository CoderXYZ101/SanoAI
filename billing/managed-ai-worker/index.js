/**
 * SanoAI managed-AI proxy — Cloudflare Worker (free tier). TEMPLATE: not deployed or tested against live services.
 *
 * Why it exists: SanoAI is a static browser app, so it cannot hold a secret API key. Paying users call THIS Worker with
 * their Firebase ID token; the Worker checks the plan and monthly quota, then calls the AI provider with SanoAI's own key.
 *
 * Secrets:  GEMINI_API_KEY, GCP_SERVICE_ACCOUNT (JSON)
 * Vars:     FIREBASE_PROJECT_ID, ALLOWED_ORIGIN (e.g. https://your-project.web.app), MODEL (default gemini-3-flash-preview)
 * Limits:   KEEP IN SYNC with src/lib/billing.ts (managedAiCalls per plan).
 *
 * Client contract: POST {worker}/chat/completions  (OpenAI-compatible body)  with  Authorization: Bearer <Firebase ID token>
 */
const LIMITS = { plus: 150, pro: 600 };
const enc = new TextEncoder();
const b64urlToBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const cors = (env) => ({
  "access-control-allow-origin": env.ALLOWED_ORIGIN || "*",
  "access-control-allow-headers": "authorization,content-type",
  "access-control-allow-methods": "POST,OPTIONS",
  vary: "origin",
});

/** Verifies a Firebase ID token (RS256) against Google's public keys and returns its uid. */
async function verifyIdToken(token, projectId) {
  const [h, p, s] = token.split(".");
  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h)));
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
  const now = Date.now() / 1000;
  if (payload.email_verified !== true || payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}` || payload.exp < now || !payload.sub) throw new Error("bad token");
  const jwks = await (await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com", { cf: { cacheTtl: 3600 } })).json();
  const jwk = jwks.keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("unknown key");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(s), enc.encode(`${h}.${p}`));
  if (!ok) throw new Error("bad signature");
  return payload.sub;
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

const docUrl = (env, path) => `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`;

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(env) });
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors(env), "content-type": "application/json" } });
    try {
      const token = (request.headers.get("authorization") || "").replace(/^Bearer /, "");
      const uid = await verifyIdToken(token, env.FIREBASE_PROJECT_ID);
      const at = await googleAccessToken(JSON.parse(env.GCP_SERVICE_ACCOUNT));
      const auth = { authorization: `Bearer ${at}` };

      const user = await (await fetch(docUrl(env, `sano_users/${uid}`), { headers: auth })).json();
      const plan = user.fields?.plan?.stringValue;
      const until = user.fields?.plan_until?.stringValue;
      if (!LIMITS[plan] || (until && new Date(until) < new Date())) return json({ error: "Managed AI needs an active paid plan." }, 402);

      const month = new Date().toISOString().slice(0, 7);
      const usageId = `${uid}_${month}`;
      const usage = await (await fetch(docUrl(env, `sano_usage/${usageId}`), { headers: auth })).json();
      const used = Number(usage.fields?.managed_ai?.integerValue ?? 0);
      if (used >= LIMITS[plan]) return json({ error: "Monthly managed-AI limit reached." }, 429);

      const body = await request.json();
      body.model = env.MODEL || "gemini-3-flash-preview";
      const upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${env.GEMINI_API_KEY}` }, body: JSON.stringify(body) });
      const text = await upstream.text();
      if (upstream.ok) {
        const mask = ["managed_ai", "user_id", "month"].map((f) => `updateMask.fieldPaths=${f}`).join("&");
        await fetch(`${docUrl(env, `sano_usage/${usageId}`)}?${mask}`, { method: "PATCH", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ fields: { managed_ai: { integerValue: String(used + 1) }, user_id: { stringValue: uid }, month: { stringValue: month } } }) });
      }
      return new Response(text, { status: upstream.status, headers: { ...cors(env), "content-type": "application/json" } });
    } catch (e) {
      return json({ error: "Unauthorised or failed request." }, 401);
    }
  },
};
