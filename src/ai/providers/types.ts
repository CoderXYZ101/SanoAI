export interface Attachment {
  mime: string;
  base64: string;
  name?: string;
}

export interface LlmRequest {
  system: string;
  user: string;
  attachments?: Attachment[];
  maxTokens?: number;
}

/**
 * Every model backend implements this interface, so engines never depend on a
 * specific vendor. Add a provider = implement two methods + register it in index.ts.
 */
export interface LlmProvider {
  id: string;
  label: string;
  model: string;
  /** true = data leaves this machine (needs user consent). false = local model (e.g. Ollama). */
  external: boolean;
  supportsPdf: boolean;
  supportsImages: boolean;
  generateJSON(req: LlmRequest, schemaName: string, jsonSchema: Record<string, unknown>): Promise<unknown>;
  generateText(req: LlmRequest): Promise<string>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly kind: "auth" | "rate_limit" | "timeout" | "network" | "bad_response" | "unsupported" | "http",
    public readonly status?: number,
  ) {
    super(message);
  }
}

export async function fetchWithTimeout(url: string, init: RequestInit, ms = 90_000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new ProviderError("The AI provider took too long to respond.", "timeout");
    throw new ProviderError("Could not reach the AI provider.", "network");
  } finally {
    clearTimeout(t);
  }
}

export function httpError(status: number, bodyText: string): ProviderError {
  const safe = bodyText.slice(0, 200).replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]");
  if (status === 401 || status === 403) return new ProviderError("The AI provider rejected the API key.", "auth", status);
  if (status === 429) return new ProviderError("The AI provider is rate-limiting requests. Try again shortly.", "rate_limit", status);
  return new ProviderError(`The AI provider returned an error (${status}). ${safe}`, "http", status);
}
