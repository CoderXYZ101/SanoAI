/**
 * Bring-your-own AI keys — stored ONLY in this browser's localStorage. They are never written to Firestore,
 * never sent to SanoAI (there is no SanoAI server), and are used to call the provider directly from the browser.
 */
export interface KeyEntry {
  key: string;
  model: string;
}
export interface AiKeys {
  gemini: KeyEntry;
  nvidia: KeyEntry;
  deepseek: KeyEntry;
  openrouter: KeyEntry;
  anthropic: KeyEntry;
  ollama: { model: string; baseUrl: string };
}

export const DEFAULT_MODELS = {
  gemini: "gemini-3-flash-preview",
  nvidia: "nvidia/nemotron-3.5-lightning-30b-a3b",
  deepseek: "deepseek-chat",
  openrouter: "nvidia/nemotron-3-ultra-550b-a55b:free",
  anthropic: "claude-sonnet-5-5",
  ollama: "",
} as const;

export const EMPTY_KEYS: AiKeys = {
  gemini: { key: "", model: DEFAULT_MODELS.gemini },
  nvidia: { key: "", model: DEFAULT_MODELS.nvidia },
  deepseek: { key: "", model: DEFAULT_MODELS.deepseek },
  openrouter: { key: "", model: DEFAULT_MODELS.openrouter },
  anthropic: { key: "", model: DEFAULT_MODELS.anthropic },
  ollama: { model: "", baseUrl: "http://localhost:11434/v1" },
};

const KEY = "sano.aiKeys.v1";

export function loadAiKeys(): AiKeys {
  if (typeof window === "undefined") return EMPTY_KEYS;
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) || "{}") as Partial<AiKeys>;
    return {
      gemini: { ...EMPTY_KEYS.gemini, ...raw.gemini },
      nvidia: { ...EMPTY_KEYS.nvidia, ...raw.nvidia },
      deepseek: { ...EMPTY_KEYS.deepseek, ...raw.deepseek },
      openrouter: { ...EMPTY_KEYS.openrouter, ...raw.openrouter },
      anthropic: { ...EMPTY_KEYS.anthropic, ...raw.anthropic },
      ollama: { ...EMPTY_KEYS.ollama, ...raw.ollama },
    };
  } catch {
    return EMPTY_KEYS;
  }
}
export function saveAiKeys(k: AiKeys) {
  window.localStorage.setItem(KEY, JSON.stringify(k));
}
export function clearAiKeys() {
  window.localStorage.removeItem(KEY);
}

/** Managed AI (paid plans): an optional proxy that holds SanoAI's own keys. Not a secret — just a URL. */
export const managedAiUrl = () => (process.env.NEXT_PUBLIC_MANAGED_AI_URL || "").replace(/\/$/, "");
