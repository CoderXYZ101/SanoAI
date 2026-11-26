import { loadAiKeys, managedAiUrl } from "@/lib/aiKeys";
import { getIdToken } from "@/lib/auth";
import { anthropicProvider } from "./anthropic";
import { openaiCompatibleProvider } from "./openai";
import type { LlmProvider } from "./types";

export type { LlmProvider } from "./types";

export interface ProviderInfo {
  id: string;
  label: string;
  model: string | null;
  configured: boolean;
  external: boolean;
}

/** Only a model on this very computer is "local"; any other address sends data elsewhere and needs consent. */
export function isThisComputer(address: string): boolean {
  try {
    return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(address).hostname);
  } catch {
    return false;
  }
}

/** Account context for SanoAI AI (the proxy that holds the owner's keys). */
export interface ProviderContext {
  /** true while the signed-in user has AI requests left this month. */
  managedAllowed: boolean;
}

/**
 * The provider CHAIN.
 *  - With the AI proxy configured (NEXT_PUBLIC_MANAGED_AI_URL): users never handle keys. A local model (Ollama), if
 *    set up, comes first; then SanoAI AI; then the built-in rule engines. Pasted cloud keys are ignored.
 *  - Without it (development / self-hosting): keys pasted into Settings, kept in that browser only:
 *    Gemini → DeepSeek → OpenRouter → Ollama (local) → Anthropic → built-in rule engines.
 */
export function resolveProviders(ctx: ProviderContext = { managedAllowed: false }): LlmProvider[] {
  const k = loadAiKeys();
  const ollama = k.ollama.model
    ? openaiCompatibleProvider({ id: "ollama", label: "Local model (Ollama)", baseUrl: k.ollama.baseUrl, apiKey: "", model: k.ollama.model, external: !isThisComputer(k.ollama.baseUrl), supportsImages: /llava|vision|gemma3|medgemma|qwen2\.5vl/i.test(k.ollama.model) })
    : null;
  const url = managedAiUrl();
  if (url) {
    const sanoAi = ctx.managedAllowed ? openaiCompatibleProvider({ id: "managed", label: "SanoAI AI", baseUrl: url, apiKey: async () => (await getIdToken()) ?? "", model: "managed", external: true, supportsImages: true, jsonMode: false, timeoutMs: 130_000 }) : null;
    return [ollama, sanoAi].filter((p): p is LlmProvider => p !== null);
  }
  const out: LlmProvider[] = [];
  if (k.gemini.key) out.push(openaiCompatibleProvider({ id: "gemini", label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", apiKey: k.gemini.key, model: k.gemini.model, external: true, supportsImages: true, extraBody: { reasoning_effort: "low" } }));
  // NVIDIA NIM does not allow browser (CORS) calls, so it is only available through the managed proxy or OpenRouter.
  if (k.deepseek.key) out.push(openaiCompatibleProvider({ id: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", apiKey: k.deepseek.key, model: k.deepseek.model, external: true }));
  if (k.openrouter.key) out.push(openaiCompatibleProvider({ id: "openrouter", label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", apiKey: k.openrouter.key, model: k.openrouter.model, external: true }));
  if (ollama) out.push(ollama);
  if (k.anthropic.key) out.push(anthropicProvider(k.anthropic.key, k.anthropic.model));
  return out;
}

export const toInfo = (p: LlmProvider): ProviderInfo => ({ id: p.id, label: p.label, model: p.model, configured: true, external: p.external });
export const DEMO_INFO: ProviderInfo = { id: "demo", label: "Offline mode (built-in engines)", model: null, configured: false, external: false };
