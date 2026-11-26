/**
 * SanoAI AI proxy — Cloudflare Worker (free tier). It holds YOUR AI key so that no user ever sees it.
 * Setup: see AI-SETUP.md. Tested against the Firebase emulator with mocked AI providers (npm run test:ai).
 * NEVER write a key in this file or anywhere in the project: add it with `wrangler secret put`.
 *
 * For every request it: checks the caller is a signed-in, email-verified SanoAI user → reads their plan → counts the
 * request against their monthly allowance → calls your AI provider(s), falling back to the next one on failure.
 *
 * Secrets (add at least one): ANTHROPIC_API_KEY (Claude), GEMINI_API_KEY, OPENROUTER_API_KEY, NVIDIA_API_KEY, DEEPSEEK_API_KEY
 * Variables (wrangler.toml): FIREBASE_PROJECT_ID (required), ALLOWED_ORIGIN (comma-separated site addresses)
 * Optional:  PROVIDER_ORDER, FREE_LIMIT / PLUS_LIMIT / PRO_LIMIT (requests per month),
 *            ANTHROPIC_MODEL, ANTHROPIC_EFFORT, CLAUDE_MAX_TOKENS (default 16000), MAX_TOKENS (others, default 8192),
 *            GEMINI_MODEL, OPENROUTER_MODEL, NVIDIA_MODEL, DEEPSEEK_MODEL
 *
 * No service account is needed: Firestore is called with the user's own token, and firestore.rules only allow the usage
 * counter to go UP by one, so a user can never reset or lower it.
 *
 * Client contract: POST {worker}/chat/completions (OpenAI-compatible)  with  Authorization: Bearer <Firebase ID token>
 */

import Anthropic from "@anthropic-ai/sdk";

// Monthly AI requests per plan. KEEP IN SYNC with src/lib/billing.ts (managedAiCalls).
const LIMITS = { free: 100, plus: 500, pro: 1500 };
const MAX_BODY = 8_000_000; // characters; room for a scanned page image

const PROVIDERS = {
  anthropic: { key: "ANTHROPIC_API_KEY", images: true, claude: true },
  gemini: { url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", key: "GEMINI_API_KEY", model: "gemini-3-flash-preview", images: true, extra: { reasoning_effort: "low" } },
  openrouter: { url: "https://openrouter.ai/api/v1/chat/completions", key: "OPENROUTER_API_KEY", model: "nvidia/nemotron-3-ultra-550b-a55b:free" },
  nvidia: { url: "https://integrate.api.nvidia.com/v1/chat/completions", key: "NVIDIA_API_KEY", model: "nvidia/nemotron-3.5-lightning-30b-a3b" },
  deepseek: { url: "https://api.deepseek.com/v1/chat/completions", key: "DEEPSEEK_API_KEY", model: "deepseek-chat" },
};

const enc = new TextEncoder();
const b64urlToBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

function cors(request, env) {
  const allowed = (env.ALLOWED_ORIGIN || "").split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
  const origin = request.headers.get("origin") || "";
  return {
    "access-control-allow-origin": !allowed.length ? "*" : allowed.includes(origin) ? origin : allowed[0],
    "access-control-allow-headers": "authorization,content-type",
    "access-control-allow-methods": "POST,OPTIONS",
    vary: "origin",
  };
}

/** Verifies a Firebase ID token (RS256) against Google's public keys and returns its uid. */
async function verifyIdToken(token, projectId) {
  const [h, p, s] = token.split(".");
  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h)));
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
  const now = Date.now() / 1000;
  if (header.alg !== "RS256" || payload.email_verified !== true || payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}` || !(payload.exp > now) || !payload.sub) throw new Error("bad token");
  const jwks = await (await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com", { cf: { cacheTtl: 3600 } })).json();
  const jwk = jwks.keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("unknown key");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(s), enc.encode(`${h}.${p}`));
  if (!ok) throw new Error("bad signature");
  return payload.sub;
}

const database = (env) => `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)`;
const firestore = (env, path) => `https://firestore.googleapis.com/v1/${database(env)}/documents${path}`;

/** The plan comes from fields users cannot write (see firestore.rules). */
async function readPlan(env, uid, auth) {
  const res = await fetch(firestore(env, `/sano_users/${uid}`), { headers: auth });
  if (!res.ok) throw new Error("profile");
  const f = (await res.json()).fields || {};
  const plan = f.plan?.stringValue;
  const until = f.plan_until?.stringValue;
  const active = (plan === "plus" || plan === "pro") && !(until && new Date(until) < new Date());
  return active ? plan : "free";
}

/** Atomically adds 1 to this month's counter and returns the new value, so parallel requests cannot slip past the limit. */
async function countRequest(env, uid, auth) {
  const month = new Date().toISOString().slice(0, 7);
  const name = `${database(env)}/documents/sano_usage/${uid}_${month}`;
  const res = await fetch(firestore(env, ":commit"), {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({
      writes: [{ update: { name, fields: { user_id: { stringValue: uid }, month: { stringValue: month } } }, updateMask: { fieldPaths: ["user_id", "month"] }, updateTransforms: [{ fieldPath: "managed_ai", increment: { integerValue: "1" } }] }],
    }),
  });
  if (!res.ok) throw new Error("usage");
  const used = Number((await res.json()).writeResults?.[0]?.transformResults?.[0]?.integerValue);
  if (!Number.isFinite(used)) throw new Error("usage");
  return used;
}

/** Only plain chat fields are forwarded, so the key cannot be used for anything else. */
function cleanRequest(input) {
  if (!Array.isArray(input?.messages) || !input.messages.length || input.messages.length > 40) return null;
  const messages = [];
  for (const m of input.messages) {
    if (!["system", "user", "assistant"].includes(m?.role)) return null;
    if (typeof m.content === "string") messages.push({ role: m.role, content: m.content });
    else if (Array.isArray(m.content)) {
      const parts = [];
      for (const part of m.content) {
        if (part?.type === "text" && typeof part.text === "string") parts.push({ type: "text", text: part.text });
        else if (part?.type === "image_url" && String(part.image_url?.url).startsWith("data:image/")) parts.push({ type: "image_url", image_url: { url: part.image_url.url } });
        else return null; // no remote URLs or other attachment types
      }
      messages.push({ role: m.role, content: parts });
    } else return null;
  }
  const t = Number(input.temperature);
  return {
    messages,
    temperature: Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0.2,
    ...(input.response_format?.type === "json_object" ? { response_format: { type: "json_object" } } : {}),
  };
}

/** The app speaks the OpenAI chat format; Claude takes the system prompt separately and images as base64 blocks. */
function toClaude(messages) {
  const system = [];
  const turns = [];
  for (const m of messages) {
    const parts = typeof m.content === "string" ? [{ type: "text", text: m.content }] : m.content;
    const content = [];
    for (const part of parts) {
      if (part.type === "text") {
        if (part.text) content.push({ type: "text", text: part.text });
        continue;
      }
      const url = part.image_url.url;
      const comma = url.indexOf(",");
      const type = /^data:(image\/(?:jpeg|png|gif|webp));base64$/.exec(url.slice(0, comma))?.[1];
      if (!type) throw new Error("unsupported image type");
      content.push({ type: "image", source: { type: "base64", media_type: type, data: url.slice(comma + 1) } });
    }
    if (m.role === "system") system.push(...content.filter((c) => c.type === "text").map((c) => c.text));
    else turns.push({ role: m.role, content });
  }
  return { system: system.join("\n\n"), messages: turns };
}

/** Claude through the official SDK. Returns the answer in the OpenAI shape the app reads, or null if there is none. */
async function askClaude(env, body) {
  const model = env.ANTHROPIC_MODEL || "claude-opus-5-5";
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 0, timeout: 110_000 });
  const { system, messages } = toClaude(body.messages);
  // Newer models take an effort level (no temperature). Server-side fallback re-runs a declined request on another model.
  const effort = /^claude-(opus-5|sonnet-5|haiku-5|fable-5)/.test(model);
  const fallback = /^claude-(fable-5-[12]|opus-5(-5)?|sonnet-5(-5)?)$/.test(model);
  const message = await client.beta.messages
    .stream(
      {
        model,
        max_tokens: Number(env.CLAUDE_MAX_TOKENS) || 16000,
        ...(system ? { system } : {}),
        messages,
        ...(effort ? { output_config: { effort: env.ANTHROPIC_EFFORT || "medium" } } : {}),
        ...(fallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {}),
      },
      { signal: AbortSignal.timeout(110_000) },
    )
    .finalMessage();
  if (message.stop_reason === "refusal") return null;
  const text = message.content.filter((block) => block.type === "text").map((block) => block.text).join("");
  if (!text) return null;
  return JSON.stringify({ model: message.model, choices: [{ message: { role: "assistant", content: text }, finish_reason: message.stop_reason === "max_tokens" ? "length" : "stop" }] });
}

async function askProviders(env, body) {
  const hasImage = body.messages.some((m) => Array.isArray(m.content) && m.content.some((p) => p.type === "image_url"));
  const order = (env.PROVIDER_ORDER || "anthropic,gemini,openrouter,nvidia,deepseek").split(",").map((s) => s.trim());
  const maxTokens = Number(env.MAX_TOKENS) || 8192;
  let busy = false;
  for (const id of order) {
    const p = PROVIDERS[id];
    if (!p || !env[p.key] || (hasImage && !p.images)) continue;
    try {
      if (p.claude) {
        const text = await askClaude(env, body);
        if (text) return { text };
        console.log("provider anthropic gave no answer");
        continue;
      }
      const res = await fetch(p.url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${env[p.key]}` },
        body: JSON.stringify({ ...p.extra, ...body, model: env[`${id.toUpperCase()}_MODEL`] || p.model, max_tokens: maxTokens }),
        signal: AbortSignal.timeout(40_000),
      });
      const text = await res.text();
      if (res.ok && JSON.parse(text).choices?.[0]?.message?.content) return { text };
      busy ||= res.status === 429;
      console.log(`provider ${id} failed: HTTP ${res.status}`);
    } catch (e) {
      busy ||= e instanceof Anthropic.RateLimitError;
      console.log(`provider ${id} failed: ${e instanceof Anthropic.APIError ? `HTTP ${e.status}` : e.name}`);
    }
  }
  return { busy };
}

export default {
  async fetch(request, env) {
    const headers = { ...cors(request, env), "content-type": "application/json" };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(request, env) });
    const fail = (error, status) => new Response(JSON.stringify({ error }), { status, headers });
    if (request.method !== "POST") return fail("Use POST.", 405);

    let uid, auth;
    try {
      const token = (request.headers.get("authorization") || "").replace(/^Bearer /, "");
      uid = await verifyIdToken(token, env.FIREBASE_PROJECT_ID);
      auth = { authorization: `Bearer ${token}` };
    } catch {
      return fail("Please sign in with a verified account.", 401);
    }

    let body;
    try {
      const raw = await request.text();
      body = raw.length <= MAX_BODY ? cleanRequest(JSON.parse(raw)) : null;
    } catch {
      body = null;
    }
    if (!body) return fail("That request is not supported.", 400);

    try {
      const plan = await readPlan(env, uid, auth);
      const limit = Number(env[`${plan.toUpperCase()}_LIMIT`] ?? LIMITS[plan]);
      if ((await countRequest(env, uid, auth)) > limit) return fail("You have used this month's AI allowance.", 429);
    } catch (e) {
      console.log(`account check failed: ${e.message}`);
      return fail("Could not check your account. Please try again.", 503);
    }

    const answer = await askProviders(env, body);
    if (answer.text) return new Response(answer.text, { status: 200, headers });
    return answer.busy ? fail("The AI service is busy. Please try again shortly.", 429) : fail("The AI service is unavailable.", 502);
  },
};
