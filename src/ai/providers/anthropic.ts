import { fetchWithTimeout, httpError, ProviderError, type LlmProvider, type LlmRequest } from "./types";

const API = "https://api.anthropic.com/v1/messages";

function contentBlocks(req: LlmRequest) {
  const blocks: unknown[] = [];
  for (const a of req.attachments ?? []) {
    if (a.mime === "application/pdf") {
      blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: a.base64 } });
    } else if (a.mime.startsWith("image/")) {
      blocks.push({ type: "image", source: { type: "base64", media_type: a.mime, data: a.base64 } });
    }
  }
  blocks.push({ type: "text", text: req.user });
  return blocks;
}

async function call(apiKey: string, body: Record<string, unknown>) {
  const res = await fetchWithTimeout(API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-dangerous-direct-browser-access": "true", // required for calls made from a browser
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw httpError(res.status, text);
  try {
    return JSON.parse(text) as { content: { type: string; text?: string; input?: unknown }[] };
  } catch {
    throw new ProviderError("The AI provider returned an unreadable response.", "bad_response");
  }
}

export function anthropicProvider(apiKey: string, model: string): LlmProvider {
  return {
    id: "anthropic",
    external: true,
    label: "Anthropic Claude",
    model,
    supportsPdf: true,
    supportsImages: true,
    async generateJSON(req, schemaName, jsonSchema) {
      // Forced tool-use gives schema-shaped JSON; we still validate with zod afterwards.
      const data = await call(apiKey, {
        model,
        max_tokens: req.maxTokens ?? 4096,
        system: req.system,
        messages: [{ role: "user", content: contentBlocks(req) }],
        tools: [{ name: schemaName, description: "Return the structured result.", input_schema: jsonSchema }],
        tool_choice: { type: "tool", name: schemaName },
      });
      const tool = data.content.find((c) => c.type === "tool_use");
      if (!tool?.input) throw new ProviderError("The AI provider did not return structured output.", "bad_response");
      return tool.input;
    },
    async generateText(req) {
      const data = await call(apiKey, {
        model,
        max_tokens: req.maxTokens ?? 4096,
        system: req.system,
        messages: [{ role: "user", content: contentBlocks(req) }],
      });
      const t = data.content
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("\n")
        .trim();
      if (!t) throw new ProviderError("The AI provider returned an empty response.", "bad_response");
      return t;
    },
  };
}
