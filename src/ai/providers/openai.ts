import { fetchWithTimeout, httpError, ProviderError, type LlmProvider, type LlmRequest } from "./types";

/** Any OpenAI-compatible chat-completions endpoint: DeepSeek, OpenRouter (free models), Ollama (local), OpenAI, vLLM, LM Studio… */
export interface OpenAICompatConfig {
  id: string;
  label: string;
  baseUrl: string;
  /** API key, or an async getter (used for per-request ID tokens). May be empty for local servers. */
  apiKey: string | (() => Promise<string>);
  model: string;
  external: boolean;
  supportsImages?: boolean;
  /** Some servers reject response_format; set false to rely on the schema in the prompt alone. */
  jsonMode?: boolean;
  timeoutMs?: number;
  extraHeaders?: Record<string, string>;
  /** Extra request-body fields (e.g. reasoning_effort for thinking models). */
  extraBody?: Record<string, unknown>;
}

function messages(req: LlmRequest, images: boolean, extraSystem = "") {
  const parts: unknown[] = [];
  for (const a of req.attachments ?? []) {
    if (a.mime.startsWith("image/") && images) parts.push({ type: "image_url", image_url: { url: `data:${a.mime};base64,${a.base64}` } });
    else throw new ProviderError("This model cannot read that attachment type; paste the text instead.", "unsupported");
  }
  parts.push({ type: "text", text: req.user });
  return [
    { role: "system", content: req.system + extraSystem },
    { role: "user", content: parts.length === 1 ? req.user : parts },
  ];
}

export function openaiCompatibleProvider(cfg: OpenAICompatConfig): LlmProvider {
  const images = cfg.supportsImages ?? false;
  async function call(body: Record<string, unknown>) {
    const key = typeof cfg.apiKey === "function" ? await cfg.apiKey() : cfg.apiKey;
    const res = await fetchWithTimeout(
      `${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}), ...cfg.extraHeaders },
        body: JSON.stringify({ model: cfg.model, ...cfg.extraBody, ...body }),
      },
      cfg.timeoutMs ?? (cfg.external ? 90_000 : 240_000), // local models can be slow on CPU
    );
    const text = await res.text();
    if (!res.ok) throw httpError(res.status, text);
    try {
      const j = JSON.parse(text) as { choices?: { message?: { content?: string }; finish_reason?: string }[] };
      const c = j.choices?.[0]?.message?.content;
      if (j.choices?.[0]?.finish_reason === "length") throw new ProviderError("The AI response was cut off (token limit).", "bad_response");
      if (!c) throw new Error("empty");
      return c;
    } catch (e) {
      if (e instanceof ProviderError) throw e;
      throw new ProviderError("The AI provider returned an unreadable response.", "bad_response");
    }
  }
  return {
    id: cfg.id,
    label: cfg.label,
    model: cfg.model,
    external: cfg.external,
    supportsPdf: false,
    supportsImages: images,
    async generateJSON(req, schemaName, jsonSchema) {
      const extra = `\n\nRespond with a single JSON object (no prose, no code fences) matching this JSON Schema named "${schemaName}":\n${JSON.stringify(jsonSchema)}`;
      const content = await call({
        max_tokens: Math.max(req.maxTokens ?? 4096, 4096),
        temperature: 0.2,
        ...(cfg.jsonMode === false ? {} : { response_format: { type: "json_object" } }),
        messages: messages(req, images, extra),
      });
      const cleaned = content.replace(/^[\s\S]*?```(?:json)?\s*([\s\S]*?)```[\s\S]*$/m, "$1").trim() || content;
      try {
        return JSON.parse(cleaned.startsWith("{") ? cleaned : cleaned.slice(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1));
      } catch {
        throw new ProviderError("The AI provider did not return valid JSON.", "bad_response");
      }
    },
    async generateText(req) {
      return (await call({ max_tokens: req.maxTokens ?? 4096, temperature: 0.2, messages: messages(req, images) })).trim();
    },
  };
}
