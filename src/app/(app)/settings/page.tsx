"use client";
import { Download, FlaskConical, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { EvalResult } from "@/ai/eval";
import { Badge, Button, Callout, Card, ErrorState, Field, LoadingBlock, Modal, PageHeader, SectionTitle, Segmented, Toggle, useToast } from "@/components/ui";
import AiKeysCard from "@/components/AiKeysCard";
import { AiOptions } from "@/components/AiChoice";
import { managedAiUrl } from "@/lib/aiKeys";
import { deleteCurrentAccount, useAuth } from "@/lib/auth";
import { apiFetch, downloadFile, useApi } from "@/lib/client";

interface Settings { consentExternalAi: boolean; consentChatMemory: boolean; readingLevel: "plain" | "detailed"; language: string }
interface Ai { provider: { id: string; label: string; model: string | null; configured: boolean }; chain?: { id: string; label: string; model: string | null; external: boolean }[]; consent: boolean; effective: "live" | "demo"; reason: string; allowance?: { used: number; limit: number } }
interface Status { ai: { provider: string; label: string; model: string | null; configured: boolean; consent: boolean; effective: string; reason: string }; integrations: Record<string, { configured: boolean; implemented: boolean; note: string }>; security: { secretsConfigured: boolean; note: string } }
interface Audit { entries: { id: string; module: string; provider: string; mode: string; sentToExternalService: boolean; consentGiven: boolean; payloadKB: number; outcome: string; detail: string | null; at: string }[] }

const LANGS = ["English", "हिन्दी", "বাংলা", "తెలుగు", "मराठी", "தமிழ்", "ગુજરાતી", "ಕನ್ನಡ", "മലയാളം", "ਪੰਜਾਬੀ", "ଓଡ଼ିଆ", "অসমীয়া", "اردو"];

export default function SettingsPage() {
  const s = useApi<{ settings: Settings; ai: Ai }>("/api/settings");
  const status = useApi<Status>("/api/system/status");
  const audit = useApi<Audit>("/api/settings/audit");
  const toast = useToast();
  const router = useRouter();
  const [evals, setEvals] = useState<{ results: EvalResult[]; passed: number; total: number } | null>(null);
  const [evalBusy, setEvalBusy] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [delBusy, setDelBusy] = useState(false);
  const isGoogle = useAuth().user?.provider === "google";

  async function update(patch: Partial<Settings>) {
    try {
      const r = await apiFetch<{ settings: Settings; ai: Ai }>("/api/settings", { method: "PUT", json: patch });
      s.setData(r);
      audit.reload();
      toast("Saved.");
      window.dispatchEvent(new Event("sano:ai")); // refresh the AI-mode bar
    } catch (e) {
      toast((e as Error).message, "err");
    }
  }

  if (s.loading && !s.data) return <LoadingBlock rows={4} />;
  if (s.error && !s.data) return <ErrorState message={s.error} onRetry={s.reload} />;
  if (!s.data) return null;
  const { settings, ai } = s.data;
  const byModule = new Map<string, EvalResult[]>();
  evals?.results.forEach((r) => byModule.set(r.module, [...(byModule.get(r.module) ?? []), r]));

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Settings" title="Privacy, AI and your data" description="You decide what SanoAI may do with your information — and you can see everything it has done." />

      {managedAiUrl() ? (
        <section id="ai" className="scroll-mt-24">
          <SectionTitle title="How SanoAI answers" />
          <Card className="card-pad space-y-4">
            <AiOptions value={settings.consentExternalAi} onChoose={(v) => update({ consentExternalAi: v })} />
            <p className="text-[14px] leading-relaxed text-navy-600">{ai.reason}</p>
          </Card>
          <details className="mt-3">
            <summary className="cursor-pointer text-[13px] font-medium text-sano-700">Advanced: use Ollama on this computer</summary>
            <div className="mt-3"><AiKeysCard localOnly onSaved={() => { s.reload(); window.dispatchEvent(new Event("sano:ai")); }} /></div>
          </details>
        </section>
      ) : (
      <>
      <section id="ai" className="scroll-mt-24">
        <SectionTitle title="AI mode" />
        <Card className="card-pad space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={ai.effective === "live" ? "teal" : "amber"}>{ai.effective === "live" ? `Live · ${ai.provider.label}${ai.provider.model ? ` · ${ai.provider.model}` : ""}` : "Demo mode · rule-based engines"}</Badge>
            <Badge tone={ai.provider.configured ? "green" : "slate"}>{ai.provider.configured ? "AI key set in this browser" : "No AI key set"}</Badge>
          </div>
          <p className="text-[14px] leading-relaxed text-navy-600">{ai.reason}</p>
          {ai.chain && ai.chain.length > 0 && (
            <ol className="space-y-1 text-[13px] text-navy-600">
              {ai.chain.map((c, i) => (
                <li key={c.id}>{i + 1}. <strong>{c.label}</strong> <span className="text-navy-400">({c.model})</span> {c.external ? <Badge tone="amber">cloud · needs consent</Badge> : <Badge tone="green">local · offline</Badge>}</li>
              ))}
              <li>{ai.chain.length + 1}. <strong>Built-in rule-based engines</strong> <Badge tone="green">offline · always available</Badge></li>
            </ol>
          )}
          {!ai.provider.configured && <Callout tone="info" title="Running without an AI key is fully supported">Timeline extraction, blind-spot detection, cross-specialty links, biomarker analysis and the assistant all work through deterministic, source-linked engines. Add your own key below to enable AI-written explanations and scanned-document reading.</Callout>}
        </Card>
      </section>

      <section id="keys" className="scroll-mt-24">
        <SectionTitle title="AI keys" hint="Offline by default. Add your own key to turn on AI." />
        <AiKeysCard onSaved={() => { s.reload(); window.dispatchEvent(new Event("sano:ai")); }} />
      </section>
      </>
      )}

      <section id="privacy" className="scroll-mt-24">
        <SectionTitle title="Privacy & consent" />
        <Card className="card-pad space-y-6">
          {!managedAiUrl() && <Toggle checked={settings.consentExternalAi} onChange={(v) => update({ consentExternalAi: v })} label="Allow sending my information to an external AI service" description="Off by default. When on, the text of your questions and (for AI-assisted modules) your extracted records can be sent to the configured provider. Every call is logged below. Turn off to use rule-based engines only." disabled={!ai.provider.configured} />}
          {!managedAiUrl() && !ai.provider.configured && <p className="-mt-4 text-[12.5px] text-navy-400">No external AI provider is configured, so nothing can be sent anywhere.</p>}
          <Toggle checked={settings.consentChatMemory} onChange={(v) => update({ consentChatMemory: v })} label="Let the assistant and modules use my records as context" description="Lets answers refer to your documents and health profile so you don't have to repeat yourself. If SanoAI AI is on, the relevant details are sent with your question." />
        </Card>
      </section>

      <section>
        <SectionTitle title="Preferences" />
        <Card className="card-pad grid gap-6 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-navy-700">Explanation level</p>
            <Segmented value={settings.readingLevel} onChange={(v) => update({ readingLevel: v })} label="Reading level" options={[{ value: "plain", label: "Plain language" }, { value: "detailed", label: "Detailed" }]} />
          </div>
          <Field label="Language for AI-written text" htmlFor="lang" hint="Applies when a live AI provider is used. Rule-based text is in English.">
            <select id="lang" className="field" value={settings.language} onChange={(e) => update({ language: e.target.value })}>
              {LANGS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </Field>
        </Card>
      </section>

      <section>
        <SectionTitle title="AI transparency ledger" hint="Every attempt to use an AI model — what, where, how much, and the outcome. Never the content itself." />
        <Card className="overflow-hidden">
          {audit.loading && !audit.data ? <div className="p-5"><LoadingBlock rows={2} /></div> : audit.data && audit.data.entries.length ? (
            <div className="max-h-80 overflow-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead className="sticky top-0 bg-navy-50 text-[11px] uppercase tracking-wide text-navy-400"><tr><th className="px-4 py-2.5">When</th><th className="px-4 py-2.5">Module</th><th className="px-4 py-2.5">Provider</th><th className="px-4 py-2.5">Left SanoAI?</th><th className="px-4 py-2.5">Size</th><th className="px-4 py-2.5">Outcome</th></tr></thead>
                <tbody className="divide-y divide-navy-100">
                  {audit.data.entries.map((e) => (
                    <tr key={e.id}>
                      <td className="whitespace-nowrap px-4 py-2 text-navy-500">{new Date(e.at).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-2 font-medium text-navy-800">{e.module}</td>
                      <td className="px-4 py-2 text-navy-600">{e.provider}</td>
                      <td className="px-4 py-2">{e.sentToExternalService ? <Badge tone="amber">Yes · consent given</Badge> : <Badge tone="green">No</Badge>}</td>
                      <td className="px-4 py-2 text-navy-500">{e.payloadKB ? `${e.payloadKB} KB` : "—"}</td>
                      <td className="px-4 py-2 text-navy-600">{e.outcome}{e.detail ? ` — ${e.detail}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="p-5 text-sm text-navy-500">No AI calls have been attempted yet.</p>}
        </Card>
      </section>

      <section>
        <SectionTitle title="What is real, what is simulated" hint="Honest capability report for this installation" />
        <Card className="card-pad">
          {status.data ? (
            <ul className="space-y-3 text-[13.5px]">
              <li className="flex flex-wrap items-center gap-2"><Badge tone={status.data.ai.configured ? "green" : "amber"}>{status.data.ai.configured ? "Configured" : "Not configured"}</Badge><strong>AI provider:</strong> {status.data.ai.label}{status.data.ai.model ? ` (${status.data.ai.model})` : ""}</li>
              {Object.entries(status.data.integrations).map(([k, v]) => (
                <li key={k} className="flex flex-wrap items-center gap-2"><Badge tone="amber">Simulated</Badge><strong>{k === "doctorDirectory" ? "Doctor directory & booking:" : "Pharmacy network:"}</strong> {v.note}</li>
              ))}
              <li className="flex flex-wrap items-center gap-2"><Badge tone={status.data.security.secretsConfigured ? "green" : "amber"}>{status.data.security.secretsConfigured ? "Set" : "Dev fallback"}</Badge><strong>Secrets:</strong> {status.data.security.note}</li>
            </ul>
          ) : <LoadingBlock rows={1} />}
        </Card>
      </section>

      <section>
        <SectionTitle title="Module self-checks" hint="Run the independent evaluation suite for every AI module — no network or key needed." action={<Button variant="secondary" loading={evalBusy} icon={<FlaskConical className="h-4 w-4" />} onClick={async () => { setEvalBusy(true); try { setEvals(await apiFetch("/api/system/eval", { method: "POST" })); } catch (e) { toast((e as Error).message, "err"); } finally { setEvalBusy(false); } }}>Run checks</Button>} />
        {evals && (
          <Card className="card-pad">
            <p className="mb-3 text-[14px] font-semibold text-navy-900">{evals.passed}/{evals.total} checks passed</p>
            <div className="grid gap-4 md:grid-cols-2">
              {[...byModule.entries()].map(([m, rs]) => (
                <div key={m}>
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-navy-400">{m} <span className="text-sano-700">{rs.filter((r) => r.passed).length}/{rs.length}</span></p>
                  <ul className="mt-1 space-y-0.5 text-[12.5px]">
                    {rs.map((r) => <li key={r.name} className={r.passed ? "text-navy-600" : "text-rose-700"}>{r.passed ? "✓" : "✗"} {r.name}{r.detail ? ` — ${r.detail}` : ""}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        )}
      </section>

      <section>
        <SectionTitle title="Your data" />
        <Card className="card-pad space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-[14px] font-medium text-navy-900">Export everything</p><p className="text-[13px] text-navy-500">Download all documents' text, extracted events, conversations, consents and AI log as JSON.</p></div>
            <Button variant="secondary" onClick={() => downloadFile("/api/settings/export").catch((e) => toast((e as Error).message, "err"))} icon={<Download className="h-4 w-4" />}>Download export</Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-navy-100 pt-4">
            <div><p className="text-[14px] font-medium text-navy-900">Delete individual documents</p><p className="text-[13px] text-navy-500">From My Medical Records — erases the stored file and everything extracted from it.</p></div>
            <Button variant="secondary" href="/records">Manage documents</Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-navy-100 pt-4">
            <div><p className="text-[14px] font-medium text-rose-700">Delete my account</p><p className="text-[13px] text-navy-500">Permanently erases your account, records, files, conversations and consents.</p></div>
            <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDelOpen(true)}>Delete account</Button>
          </div>
        </Card>
      </section>

      <Modal open={delOpen} onClose={() => setDelOpen(false)} title="Delete your account permanently?">
        <p className="text-sm leading-relaxed text-navy-600">Everything will be erased and cannot be recovered. {isGoogle ? "You will be asked to confirm with Google." : "Enter your password to confirm."}</p>
        {!isGoogle && <div className="mt-4"><Field label="Password" htmlFor="dpw"><input id="dpw" type="password" className="field" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></Field></div>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDelOpen(false)}>Cancel</Button>
          <Button variant="danger" loading={delBusy} disabled={!isGoogle && !pw} onClick={async () => { setDelBusy(true); try { await deleteCurrentAccount(pw); router.push("/"); } catch (e) { toast((e as Error).message, "err"); setDelBusy(false); } }}>{isGoogle ? "Confirm with Google & delete" : "Delete everything"}</Button>
        </div>
      </Modal>
    </div>
  );
}
