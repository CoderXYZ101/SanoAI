"use client";
import { CheckCircle2, KeyRound, Trash2, XCircle } from "lucide-react";
import { useState } from "react";
import { isThisComputer, resolveProviders } from "@/ai/providers";
import { clearAiKeys, DEFAULT_MODELS, loadAiKeys, saveAiKeys, type AiKeys } from "@/lib/aiKeys";
import { apiFetch } from "@/lib/client";
import { Badge, Button, Callout, Card, Field, useToast } from "@/components/ui";

type Cloud = "gemini" | "deepseek" | "openrouter" | "anthropic";
const CLOUD: { id: Cloud; label: string; hint: string; get: string }[] = [
  { id: "gemini", label: "Google Gemini", hint: "Free tier available — fast and reads images.", get: "aistudio.google.com/apikey" },
  { id: "deepseek", label: "DeepSeek", hint: "Very low cost.", get: "platform.deepseek.com" },
  { id: "openrouter", label: "OpenRouter", hint: "Has free “:free” models, including NVIDIA Nemotron.", get: "openrouter.ai/keys" },
  { id: "anthropic", label: "Anthropic Claude", hint: "Used last, only if nothing else works.", get: "console.anthropic.com" },
];

/**
 * Bring-your-own AI keys. Stored in THIS browser only (localStorage) and used to call the provider directly.
 * `localOnly` (when SanoAI AI is set up) shows just the local-model fields.
 */
export default function AiKeysCard({ onSaved, localOnly = false }: { onSaved?: () => void; localOnly?: boolean }) {
  const [keys, setKeys] = useState<AiKeys>(() => loadAiKeys());
  const [test, setTest] = useState<Record<string, "ok" | "fail" | "busy" | undefined>>({});
  const [msg, setMsg] = useState<Record<string, string>>({});
  const toast = useToast();

  async function save() {
    saveAiKeys(keys);
    const anyCloud = !localOnly && CLOUD.some((c) => keys[c.id].key.trim());
    // Pasting your own key is your consent to call that provider; the toggle in Privacy can still switch it off.
    if (anyCloud) await apiFetch("/api/settings", { method: "PUT", json: { consentExternalAi: true } }).catch(() => {});
    toast(localOnly ? "Local model saved in this browser." : "AI keys saved in this browser.");
    onSaved?.();
  }

  async function check(id: string) {
    saveAiKeys(keys);
    setTest((t) => ({ ...t, [id]: "busy" }));
    const p = resolveProviders().find((x) => x.id === id);
    if (!p) {
      setTest((t) => ({ ...t, [id]: "fail" }));
      setMsg((m) => ({ ...m, [id]: "Enter a key (or model for Ollama) first." }));
      return;
    }
    try {
      const text = await p.generateText({ system: "Reply with the single word: ok", user: "ping", maxTokens: 256 });
      setTest((t) => ({ ...t, [id]: "ok" }));
      setMsg((m) => ({ ...m, [id]: `Works — replied “${text.slice(0, 30)}”.` }));
    } catch (e) {
      setTest((t) => ({ ...t, [id]: "fail" }));
      setMsg((m) => ({ ...m, [id]: `${(e as Error).message} (If the browser blocked the request, this provider may not allow direct browser calls — try another.)` }));
    }
  }

  return (
    <Card className="card-pad space-y-5">
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 h-5 w-5 text-sano-600" />
        <div>
          <h3 className="text-[15px] font-semibold text-navy-900">{localOnly ? "Use a model on this computer" : "Your AI keys"}</h3>
          <p className="mt-0.5 text-[13px] leading-relaxed text-navy-500">{localOnly ? "Optional, for people who run Ollama. When set, it is tried before SanoAI AI. Leave the model empty to turn it off." : "Optional. SanoAI works fully offline without them. Keys stay in this browser only — they are never uploaded to SanoAI or Firestore. They are tried in the order below; if one fails, the next is used."}</p>
        </div>
      </div>
      <div className="space-y-4">
        {!localOnly && CLOUD.map((c) => (
          <div key={c.id} className="rounded-xl border border-navy-100 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[14px] font-semibold text-navy-800">{c.label}</p>
              <span className="text-[12px] text-navy-400">{c.hint} Get a key: {c.get}</span>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1.6fr_1fr_auto]">
              <input type="password" autoComplete="off" aria-label={`${c.label} API key`} className="field" placeholder="API key" value={keys[c.id].key} onChange={(e) => setKeys({ ...keys, [c.id]: { ...keys[c.id], key: e.target.value.trim() } })} />
              <input aria-label={`${c.label} model`} className="field" value={keys[c.id].model} onChange={(e) => setKeys({ ...keys, [c.id]: { ...keys[c.id], model: e.target.value.trim() || DEFAULT_MODELS[c.id] } })} />
              <Button variant="secondary" size="md" loading={test[c.id] === "busy"} disabled={!keys[c.id].key} onClick={() => check(c.id)}>
                Test
              </Button>
            </div>
            {msg[c.id] && (
              <p className={`mt-1.5 flex items-start gap-1.5 text-[12.5px] ${test[c.id] === "ok" ? "text-sano-700" : "text-rose-700"}`}>
                {test[c.id] === "ok" ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                {msg[c.id]}
              </p>
            )}
          </div>
        ))}
        <div className="rounded-xl border border-navy-100 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[14px] font-semibold text-navy-800">Local model (Ollama)</p>
            {isThisComputer(keys.ollama.baseUrl) ? <Badge tone="green">stays on your computer</Badge> : <Badge tone="amber">another computer · needs consent</Badge>}
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
            <input aria-label="Ollama model" className="field" placeholder="e.g. qwen2.5:7b" value={keys.ollama.model} onChange={(e) => setKeys({ ...keys, ollama: { ...keys.ollama, model: e.target.value.trim() } })} />
            <input aria-label="Ollama URL" className="field" value={keys.ollama.baseUrl} onChange={(e) => setKeys({ ...keys, ollama: { ...keys.ollama, baseUrl: e.target.value.trim() } })} />
            <Button variant="secondary" loading={test.ollama === "busy"} disabled={!keys.ollama.model} onClick={() => check("ollama")}>
              Test
            </Button>
          </div>
          {msg.ollama && <p className={`mt-1.5 text-[12.5px] ${test.ollama === "ok" ? "text-sano-700" : "text-rose-700"}`}>{msg.ollama}</p>}
          <p className="mt-1.5 text-[12px] text-navy-400">Requires Ollama running with browser access allowed (set OLLAMA_ORIGINS to this site).</p>
        </div>
      </div>
      {!localOnly && <Callout tone="info">Anyone with access to this browser profile could read saved keys. On shared computers, use “Remove all keys” when you finish.</Callout>}
      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="ghost" className="text-rose-600 hover:bg-rose-50" icon={<Trash2 className="h-4 w-4" />} onClick={() => { clearAiKeys(); setKeys(loadAiKeys()); setTest({}); setMsg({}); toast(localOnly ? "Local model removed." : "All AI keys removed from this browser."); onSaved?.(); }}>
          {localOnly ? "Remove local model" : "Remove all keys"}
        </Button>
        <Button onClick={save}>{localOnly ? "Save" : "Save keys"}</Button>
      </div>
    </Card>
  );
}
