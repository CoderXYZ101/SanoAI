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

/** Account entitlement context for the managed-AI (paid) provider. */
export interface ProviderContext {
  /** true when the signed-in user's plan includes managed AI. */
  managedAllowed: boolean;
}

/**
 * The provider CHAIN, in priority order, built from keys the user pasted into Settings (kept in this browser only):
 *   managed (paid plans) → Gemini → NVIDIA → DeepSeek → OpenRouter → Ollama (local) → Anthropic → built-in rule engines.
 * If nothing is configured the app runs fully offline on its rule-based engines.
 */
export function resolveProviders(ctx: ProviderContext = { managedAllowed: false }): LlmProvider[] {
  const k = loadAiKeys();
  const out: LlmProvider[] = [];
  const url = managedAiUrl();
  if (ctx.managedAllowed && url) {
    out.push(openaiCompatibleProvider({ id: "managed", label: "SanoAI managed AI", baseUrl: url, apiKey: async () => (await getIdToken()) ?? "", model: "managed", external: true, supportsImages: true, jsonMode: false }));
  }
  if (k.gemini.key) out.push(openaiCompatibleProvider({ id: "gemini", label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", apiKey: k.gemini.key, model: k.gemini.model, external: true, supportsImages: true, extraBody: { reasoning_effort: "low" } }));
  // NVIDIA NIM does not allow browser (CORS) calls, so it is only available through the managed proxy or OpenRouter.
  if (k.deepseek.key) out.push(openaiCompatibleProvider({ id: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", apiKey: k.deepseek.key, model: k.deepseek.model, external: true }));
  if (k.openrouter.key) out.push(openaiCompatibleProvider({ id: "openrouter", label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", apiKey: k.openrouter.key, model: k.openrouter.model, external: true }));
  if (k.ollama.model) out.push(openaiCompatibleProvider({ id: "ollama", label: "Local model (Ollama)", baseUrl: k.ollama.baseUrl, apiKey: "", model: k.ollama.model, external: false, supportsImages: /llava|vision|gemma3|qwen2\.5vl/i.test(k.ollama.model) }));
  if (k.anthropic.key) out.push(anthropicProvider(k.anthropic.key, k.anthropic.model));
  return out;
}

export const toInfo = (p: LlmProvider): ProviderInfo => ({ id: p.id, label: p.label, model: p.model, configured: true, external: p.external });
export const DEMO_INFO: ProviderInfo = { id: "demo", label: "Offline mode (built-in engines)", model: null, configured: false, external: false };
