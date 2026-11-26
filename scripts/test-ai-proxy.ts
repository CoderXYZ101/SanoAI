/**
 * Tests the AI proxy (billing/managed-ai-worker) against the local Firebase emulators with a FAKE AI provider.
 *   1) npm run emulators      2) npm run test:ai
 * No real key or AI service is used.
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — the worker is plain JavaScript so it can be pasted into the Cloudflare editor
import worker from "../billing/managed-ai-worker/index.js";

const PROJECT = "demo-sanoai";
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const month = new Date().toISOString().slice(0, 7);
const enc = new TextEncoder();
const b64 = (v: string | ArrayBuffer) => Buffer.from(typeof v === "string" ? enc.encode(v) : new Uint8Array(v)).toString("base64url");

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, detail: unknown = "") => {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${ok ? "" : ` — ${JSON.stringify(detail)}`}`);
};

type Sent = { url: string; auth: string; beta: string; body: Record<string, any> };

/** A minimal streamed Claude reply, in the format the official SDK reads. */
function claudeReply(text: string) {
  const events: [string, unknown][] = [
    ["message_start", { type: "message_start", message: { id: "msg_test", type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } }],
    ["content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }],
    ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } }],
    ["content_block_stop", { type: "content_block_stop", index: 0 }],
    ["message_delta", { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 1 } }],
    ["message_stop", { type: "message_stop" }],
  ];
  return new Response(events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join(""), { headers: { "content-type": "text/event-stream" } });
}
const sent: Sent[] = [];
const broken = new Set<string>();

async function main() {
  const keys = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const jwk = { ...(await crypto.subtle.exportKey("jwk", keys.publicKey)), kid: "test-key" };
  async function token(uid: string, claims: Record<string, unknown> = {}) {
    const now = Math.floor(Date.now() / 1000);
    const head = b64(JSON.stringify({ alg: "RS256", kid: "test-key", typ: "JWT" }));
    const body = b64(JSON.stringify({ iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, sub: uid, user_id: uid, email: `${uid}@example.test`, email_verified: true, iat: now, auth_time: now, exp: now + 3600, firebase: { sign_in_provider: "password" }, ...claims }));
    return `${head}.${body}.${b64(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keys.privateKey, enc.encode(`${head}.${body}`)))}`;
  }

  // fake Google keys and AI providers; Firestore calls go to the emulator
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("securetoken@system")) return Response.json({ keys: [jwk] });
    if (url.startsWith("https://firestore.googleapis.com/")) return realFetch(url.replace("https://firestore.googleapis.com", "http://127.0.0.1:8080"), init);
    if (url.startsWith("https://api.anthropic.com/")) {
      const h = new Headers(init?.headers);
      // the official SDK sends the API key as "Authorization: Bearer" (older versions used x-api-key)
      sent.push({ url, auth: String(h.get("authorization") ?? h.get("x-api-key")), beta: String(h.get("anthropic-beta")), body: JSON.parse(String(init?.body)) });
      if (broken.has("anthropic")) return Response.json({ type: "error", error: { type: "api_error", message: "upstream secret detail" } }, { status: 500 });
      return claudeReply("ok from claude");
    }
    if (url.endsWith("/chat/completions")) {
      const auth = String(new Headers(init?.headers).get("authorization"));
      sent.push({ url, auth, beta: "", body: JSON.parse(String(init?.body)) });
      if ([...broken].some((b) => url.includes(b))) return new Response("upstream secret detail", { status: 500 });
      return Response.json({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] });
    }
    return realFetch(input, init);
  }) as typeof fetch;

  const env = { FIREBASE_PROJECT_ID: PROJECT, ALLOWED_ORIGIN: "https://app.example.test", GEMINI_API_KEY: "fake-gemini", OPENROUTER_API_KEY: "fake-openrouter", FREE_LIMIT: "3" };
  const hello = { model: "anything", messages: [{ role: "user", content: "hello" }] };
  async function call(tok: string | null, body: unknown = hello, extra: Record<string, string> = {}, origin = "https://app.example.test") {
    const res: Response = await worker.fetch(new Request("https://proxy.test/chat/completions", { method: "POST", headers: { origin, "content-type": "application/json", ...(tok ? { authorization: `Bearer ${tok}` } : {}) }, body: JSON.stringify(body) }), { ...env, ...extra });
    return { status: res.status, text: await res.text(), origin: res.headers.get("access-control-allow-origin") };
  }
  const str = (v: string) => ({ stringValue: v });
  async function makeUser(uid: string, plan = "free") {
    await realFetch(`${FS}/sano_users?documentId=${uid}`, { method: "POST", headers: { Authorization: "Bearer owner", "content-type": "application/json" }, body: JSON.stringify({ fields: { id: str(uid), user_id: str(uid), email: str(`${uid}@example.test`), plan: str(plan) } }) });
  }
  const used = async (uid: string) => Number((await (await realFetch(`${FS}/sano_usage/${uid}_${month}`, { headers: { Authorization: "Bearer owner" } })).json()).fields?.managed_ai?.integerValue ?? 0);

  const run = Date.now().toString(36);
  const free = `free-${run}`;
  await makeUser(free);
  const t = await token(free);

  console.log("\nWho may call");
  check("no sign-in is refused", (await call(null)).status === 401);
  check("unverified email is refused", (await call(await token(free, { email_verified: false }))).status === 401);
  check("token for another project is refused", (await call(await token(free, { aud: "other" }))).status === 401);
  const forged = t.slice(0, -8) + (t.endsWith("AAAAAAAA") ? "BBBBBBBB" : "AAAAAAAA");
  check("tampered signature is refused", (await call(forged)).status === 401);
  check("unsupported request is refused without using allowance", (await call(t, { messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: "https://evil.example/x.png" } }] }] })).status === 400 && (await used(free)) === 0);
  check("nothing reached the AI so far", sent.length === 0);

  console.log("\nFree user");
  const first = await call(t, { ...hello, max_tokens: 99999999, tools: [{}], n: 50 });
  check("verified free user gets an answer", first.status === 200 && first.text.includes('"ok"'), first);
  const s = sent.at(-1)!;
  check("the owner's key is added by the proxy", s.auth === "Bearer fake-gemini");
  check("model and token ceiling are set by the proxy", s.body.model === "gemini-3-flash-preview" && s.body.max_tokens === 8192, s.body);
  check("extra request fields are dropped", !("tools" in s.body) && !("n" in s.body), s.body);
  check("the key is never in the response", !first.text.includes("fake-"));
  check("request is counted", (await used(free)) === 1, await used(free));

  broken.add("googleapis.com/v1beta");
  const second = await call(t);
  check("falls back to the next provider", second.status === 200 && sent.at(-1)!.auth === "Bearer fake-openrouter", second);
  broken.add("openrouter.ai");
  const third = await call(t);
  check("all providers down gives a clean error", third.status === 502 && !third.text.includes("secret") && !third.text.includes("fake-"), third);
  broken.clear();
  const before = sent.length;
  const fourth = await call(t);
  check("over the monthly allowance is refused", fourth.status === 429 && sent.length === before, fourth);

  console.log("\nThe counter cannot be cheated");
  const asUser = { Authorization: `Bearer ${t}`, "content-type": "application/json" };
  const doc = `${FS}/sano_usage/${free}_${month}`;
  const lower = await realFetch(`${doc}?updateMask.fieldPaths=managed_ai`, { method: "PATCH", headers: asUser, body: JSON.stringify({ fields: { managed_ai: { integerValue: "0" } } }) });
  check("user cannot reset the counter", lower.status === 403, lower.status);
  const del = await realFetch(doc, { method: "DELETE", headers: asUser });
  check("user cannot delete the counter", del.status === 403, del.status);
  const other = await realFetch(`${FS}/sano_usage?documentId=someone-else_${month}`, { method: "POST", headers: asUser, body: JSON.stringify({ fields: { user_id: str(free), month: str(month), managed_ai: { integerValue: "1" } } }) });
  check("user cannot create counters under other ids", other.status === 403, other.status);

  console.log("\nPlans, images, browsers");
  const paid = `paid-${run}`;
  await makeUser(paid, "plus");
  const pt = await token(paid);
  const results: number[] = [];
  for (let i = 0; i < 5; i++) results.push((await call(pt)).status);
  check("paid plan has a higher allowance than free", results.every((r) => r === 200), results);
  const parallelUser = `par-${run}`;
  await makeUser(parallelUser);
  const qt = await token(parallelUser);
  const burst = await Promise.all(Array.from({ length: 8 }, () => call(qt)));
  check("parallel requests cannot exceed the allowance", burst.filter((r) => r.status === 200).length <= 3, burst.map((r) => r.status));
  const img = { messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } }, { type: "text", text: "read" }] }] };
  const n = sent.length;
  broken.add("googleapis.com/v1beta");
  const imgRes = await call(pt, img);
  check("images only go to a provider that can read them", imgRes.status === 502 && sent.slice(n).every((x) => x.url.includes("googleapis")), imgRes);
  broken.clear();
  check("other websites are not allowed by CORS", (await call(null, hello, {}, "https://evil.example")).origin === "https://app.example.test");

  console.log("\nClaude");
  const cu = `claude-${run}`;
  await makeUser(cu);
  const ct = await token(cu);
  const withClaude = { ANTHROPIC_API_KEY: "fake-claude", FREE_LIMIT: "50" };
  const chat = { temperature: 0.2, messages: [{ role: "system", content: "be careful" }, { role: "user", content: [{ type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } }, { type: "text", text: "read this" }] }] };
  const c = await call(ct, chat, withClaude);
  const cs = sent.at(-1)!;
  check("Claude is used first when its key is set", c.status === 200 && cs.url.includes("api.anthropic.com"), c);
  check("answer comes back in the format the app reads", JSON.parse(c.text).choices[0].message.content === "ok from claude" && JSON.parse(c.text).choices[0].finish_reason === "stop", c.text);
  check("the Claude key is added by the proxy only", cs.auth === "Bearer fake-claude" && !c.text.includes("fake-"));
  check("system prompt and image are converted", cs.body.system === "be careful" && cs.body.messages.length === 1 && cs.body.messages[0].content[0].source?.media_type === "image/png", cs.body);
  check("model, token ceiling and effort set; no temperature", cs.body.model === "claude-opus-5-5" && cs.body.max_tokens === 16000 && cs.body.output_config?.effort === "medium" && !("temperature" in cs.body), cs.body);
  check("refusal fallback is enabled", cs.body.fallbacks === "default" && cs.beta.includes("server-side-fallback-2026-07-01"), { f: cs.body.fallbacks, beta: cs.beta });
  await call(ct, hello, { ...withClaude, ANTHROPIC_MODEL: "claude-haiku-5-5" });
  check("a cheaper model can be chosen, without unsupported options", sent.at(-1)!.body.model === "claude-haiku-5-5" && !("fallbacks" in sent.at(-1)!.body), sent.at(-1)!.body);
  broken.add("anthropic");
  const fb = await call(ct, hello, withClaude);
  check("if Claude fails, the next provider answers", fb.status === 200 && sent.at(-1)!.auth === "Bearer fake-gemini", fb);
  const only = await call(ct, hello, { ...withClaude, PROVIDER_ORDER: "anthropic" });
  check("Claude errors are not passed to the browser", only.status === 502 && !only.text.includes("secret") && !only.text.includes("fake-"), only);
  broken.clear();

  console.log(`\n${passed}/${passed + failed} AI proxy checks passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
