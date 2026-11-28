import { z } from "zod";
import { DEMO_INFO, resolveProviders, toInfo, type ProviderInfo } from "./providers";
import { ProviderError, type Attachment, type LlmProvider } from "./providers/types";
import { guardValue } from "./safety";
import type { AiMeta } from "./types";
import { aiAllowance } from "@/lib/billing";
import { managedAiUrl } from "@/lib/aiKeys";
import { getSettings, logAudit } from "@/lib/repo";

/**
 * The single gateway between SanoAI engines and any AI model.
 *
 * Provider CHAIN (AI_PROVIDER_ORDER): free/cheap cloud (DeepSeek, OpenRouter free) → local offline model (Ollama)
 * → … → rule-based engines. A provider that errors, rate-limits or returns invalid output is skipped and the next
 * one is tried; if none works, the caller falls back to the labelled rule-based engine.
 *
 *  - EXTERNAL providers need the user's explicit consent; LOCAL models (Ollama) never leave the machine, so they don't.
 *  - JSON is validated with zod + engine validators + the medical-language guard.
 *  - Every attempt is written to a content-free audit ledger visible to the user.
 *  - NEVER pretends: on failure it returns { ok:false, meta } with a plain-language notice.
 */

export interface AiStatus {
  provider: ProviderInfo; // first usable provider (or demo)
  chain: ProviderInfo[]; // all configured providers in priority order
  consent: boolean;
  effective: "live" | "demo";
  reason: string;
  /** Present when SanoAI AI is set up: this month's requests. */
  allowance?: { used: number; limit: number };
}

async function chainFor(userId: string) {
  const allowance = managedAiUrl() ? await aiAllowance(userId) : undefined;
  return { allowance, all: resolveProviders({ managedAllowed: Boolean(allowance && allowance.left > 0) }) };
}
async function usableProviders(userId: string, consent: boolean): Promise<LlmProvider[]> {
  const { all } = await chainFor(userId);
  return all.filter((p) => !p.external || consent);
}

export async function aiStatus(userId: string): Promise<AiStatus> {
  const { all, allowance } = await chainFor(userId);
  const consent = (await getSettings(userId)).consentExternalAi;
  const chain = all.map(toInfo);
  // with a local model set up, the general chain description below applies
  if (allowance && !all.some((p) => p.id === "ollama")) {
    const sanoAi: ProviderInfo = { id: "managed", label: "SanoAI AI", model: null, configured: true, external: true };
    const live = consent && allowance.left > 0;
    const reason = !consent
      ? "You chose built-in rules. Nothing is sent to an AI service."
      : live
        ? `SanoAI AI is on: ${allowance.left} of ${allowance.limit} requests left this month. Built-in rules take over if it is unavailable.`
        : `You have used all ${allowance.limit} AI requests for this month, so built-in rules are being used until next month.`;
    return { provider: sanoAi, chain, consent, effective: live ? "live" : "demo", reason, allowance };
  }
  if (!all.length) {
    return { provider: DEMO_INFO, chain, consent, effective: "demo", reason: "No AI key is set, so SanoAI is running its built-in engines — fully offline and private. Add your own key in Settings → AI keys (kept only in this browser), or upgrade for managed AI." };
  }
  const usable = await usableProviders(userId, consent);
  if (!usable.length) {
    return {
      provider: toInfo(all[0]),
      chain,
      consent,
      effective: "demo",
      reason: `${all[0].label} is configured, but you have not allowed sending your information to an external AI service (see Settings). Built-in engines are being used instead. A model on this computer needs no consent.`,
    };
  }
  const p = usable[0];
  const names = usable.map((u) => `${u.label}${u.external ? "" : " — local, offline"}`);
  return { provider: toInfo(p), chain, consent, effective: "live", allowance, reason: `Live analysis: ${names.join(" → ")} → rule-based engine as the final fallback.` };
}

export async function demoMeta(userId: string, extraNotice?: string): Promise<AiMeta> {
  const s = (await aiStatus(userId));
  return {
    mode: "demo",
    provider: "SanoAI rule-based engine",
    notice: [s.effective === "demo" ? s.reason : "", extraNotice].filter(Boolean).join(" ") || undefined,
  };
}

export type StructuredResult<T> = { ok: true; data: T; meta: AiMeta } | { ok: false; meta: AiMeta };

interface Opts<T> {
  userId: string;
  module: string;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  schemaName: string;
  attachments?: Attachment[];
  maxTokens?: number;
  /** Engine-specific semantic check. Return an error string to reject the output. */
  validate?: (data: T) => string | null;
  /** Skip the language guard (e.g. when transcribing an original record verbatim). */
  skipGuard?: boolean;
}

const payloadSize = (o: { system: string; user: string; attachments?: Attachment[] }) =>
  o.system.length + o.user.length + (o.attachments ?? []).reduce((n, a) => n + a.base64.length, 0);

const canHandle = (p: LlmProvider, atts?: Attachment[]) =>
  (atts ?? []).every((a) => (a.mime === "application/pdf" ? p.supportsPdf : a.mime.startsWith("image/") ? p.supportsImages : false));

const mode = (_p: LlmProvider): "live" => "live"; // local models are still live AI, just offline

export async function runStructured<T>(o: Opts<T>): Promise<StructuredResult<T>> {
  const status = (await aiStatus(o.userId));
  const chain = (await usableProviders(o.userId, status.consent)).filter((p) => canHandle(p, o.attachments));
  const bytes = payloadSize(o);

  if (!chain.length) {
    (await logAudit(o.userId, { module: o.module, provider: status.provider.id, mode: "demo", external: false, consent: status.consent, payloadBytes: 0, outcome: status.chain.length ? "blocked-no-consent-or-capability" : "no-provider" }));
    return { ok: false, meta: (await demoMeta(o.userId)) };
  }

  const jsonSchema = z.toJSONSchema(o.schema, { target: "draft-7", io: "input" }) as Record<string, unknown>;
  delete jsonSchema.$schema;
  const failures: string[] = [];

  const started = Date.now();
  for (const provider of chain) {
    let feedback = "";
    let lastError = "unknown error";
    let skipRest = false;
    // a second try only when the first answered quickly, so nobody waits minutes for a page
    for (let attempt = 0; attempt < 2 && !skipRest && (attempt === 0 || Date.now() - started < 20_000); attempt++) {
      try {
        const raw = await provider.generateJSON({ system: o.system, user: o.user + feedback, attachments: o.attachments, maxTokens: o.maxTokens }, o.schemaName, jsonSchema);
        const parsed = o.schema.safeParse(raw);
        if (!parsed.success) {
          lastError = `schema: ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message}`;
          feedback = `\n\nYour previous answer was rejected because it did not match the required schema (${lastError}). Return a corrected answer.`;
          continue;
        }
        if (!o.skipGuard) {
          const g = guardValue(parsed.data);
          if (!g.ok) {
            lastError = `safety: ${g.violations.join(", ")}`;
            feedback = `\n\nYour previous answer was rejected by a medical-safety filter (${g.violations.join(", ")}). Rewrite it without diagnosing, blaming clinicians, or advising changes to prescribed treatment.`;
            continue;
          }
        }
        const semantic = o.validate?.(parsed.data);
        if (semantic) {
          lastError = `validation: ${semantic}`;
          feedback = `\n\nYour previous answer was rejected: ${semantic}. Return a corrected answer.`;
          continue;
        }
        (await logAudit(o.userId, { module: o.module, provider: provider.id, mode: mode(provider), external: provider.external, consent: provider.external ? status.consent : true, payloadBytes: provider.external ? bytes : 0, outcome: "ok" }));
        const fell = failures.length ? ` (after ${failures.length} provider${failures.length === 1 ? "" : "s"} failed)` : "";
        return { ok: true, data: parsed.data, meta: { mode: "live", provider: `${provider.label}${provider.external ? "" : " · offline"}`, model: provider.model, notice: failures.length ? `Answered by ${provider.label}${fell}.` : undefined } };
      } catch (e) {
        const pe = e instanceof ProviderError ? e : null;
        lastError = pe?.message ?? "unexpected error";
        // an unreadable answer gets one retry; a timeout or network failure moves straight on
        if (pe && pe.kind === "bad_response" && attempt === 0 && provider.external) continue;
        skipRest = true;
      }
    }
    failures.push(`${provider.label}: ${lastError}`);
    (await logAudit(o.userId, { module: o.module, provider: provider.id, mode: "live", external: provider.external, consent: provider.external ? status.consent : true, payloadBytes: provider.external ? bytes : 0, outcome: "failed", detail: lastError }));
  }

  return {
    ok: false,
    meta: { mode: "demo", provider: "SanoAI rule-based engine", notice: `AI request failed (${failures.join("; ")}). Showing rule-based results instead — nothing was fabricated.` },
  };
}

/** Free-text generation (used for document transcription). */
export async function runText(o: { userId: string; module: string; system: string; user: string; attachments?: Attachment[]; maxTokens?: number }): Promise<{ ok: true; text: string; meta: AiMeta } | { ok: false; meta: AiMeta }> {
  const status = (await aiStatus(o.userId));
  const chain = (await usableProviders(o.userId, status.consent)).filter((p) => canHandle(p, o.attachments));
  const bytes = payloadSize(o);
  if (!chain.length) {
    (await logAudit(o.userId, { module: o.module, provider: status.provider.id, mode: "demo", external: false, consent: status.consent, payloadBytes: 0, outcome: status.chain.length ? "no-capable-provider-or-consent" : "no-provider" }));
    return { ok: false, meta: (await demoMeta(o.userId, o.attachments?.length ? "None of the available models can read images/PDFs, so paste the text instead." : undefined)) };
  }
  const failures: string[] = [];
  for (const provider of chain) {
    try {
      const text = await provider.generateText(o);
      (await logAudit(o.userId, { module: o.module, provider: provider.id, mode: "live", external: provider.external, consent: provider.external ? status.consent : true, payloadBytes: provider.external ? bytes : 0, outcome: "ok" }));
      return { ok: true, text, meta: { mode: "live", provider: provider.label, model: provider.model } };
    } catch (e) {
      const msg = e instanceof ProviderError ? e.message : "unexpected error";
      failures.push(`${provider.label}: ${msg}`);
      (await logAudit(o.userId, { module: o.module, provider: provider.id, mode: "live", external: provider.external, consent: provider.external ? status.consent : true, payloadBytes: provider.external ? bytes : 0, outcome: "failed", detail: msg }));
    }
  }
  return { ok: false, meta: { mode: "demo", provider: "SanoAI rule-based engine", notice: `The AI request failed (${failures.join("; ")}).` } };
}
