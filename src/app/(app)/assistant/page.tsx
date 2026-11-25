"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, History, Mic, Paperclip, Plus, Send, Square, Trash2, Volume2, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessageDTO, DocumentDTO } from "@/ai/types";
import { Markdown } from "@/components/Markdown";
import { AiModeChip, Badge, Button, Callout, ErrorState, LogoMark, useToast } from "@/components/ui";
import { apiFetch, ApiClientError } from "@/lib/client";

interface Conv {
  id: string;
  title: string;
  updated_at: string;
}

const STARTERS = [
  "Summarise my medical records",
  "Explain what a low ferritin result might mean",
  "What information might be missing from my records?",
  "Prepare questions for my next appointment",
  "What is the difference between HbA1c and fasting glucose?",
];

type SR = { new (): { lang: string; interimResults: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start(): void; stop(): void } };

function Assistant() {
  const params = useSearchParams();
  const [convs, setConvs] = useState<Conv[]>([]);
  const [convId, setConvId] = useState<string | null>(params.get("c"));
  const [messages, setMessages] = useState<ChatMessageDTO[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<{ text: string; retry: string } | null>(null);
  const [showList, setShowList] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [ctx, setCtx] = useState<{ memory: boolean; mode: string } | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<InstanceType<SR> | null>(null);
  const toast = useToast();

  const loadList = useCallback(async () => {
    try {
      setConvs((await apiFetch<{ conversations: Conv[] }>("/api/chat")).conversations);
    } catch {
      /* non-critical */
    }
  }, []);

  useEffect(() => {
    void loadList();
    apiFetch<{ settings: { consentChatMemory: boolean }; ai: { effective: string } }>("/api/auth/me").then((m) => setCtx({ memory: m.settings.consentChatMemory, mode: m.ai.effective })).catch(() => {});
  }, [loadList]);

  const open = useCallback(async (id: string | null) => {
    setConvId(id);
    setError(null);
    setShowList(false);
    if (!id) return setMessages([]);
    try {
      setMessages((await apiFetch<{ messages: ChatMessageDTO[] }>(`/api/chat/${id}`)).messages);
    } catch (e) {
      setError({ text: (e as Error).message, retry: "" });
    }
  }, []);

  useEffect(() => {
    const c = params.get("c");
    if (c) void open(c);
  }, [params, open]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  async function send(text = input) {
    const message = text.trim();
    if (!message || sending) return;
    setInput("");
    setError(null);
    setSending(true);
    const optimistic: ChatMessageDTO = { id: `tmp-${Date.now()}`, role: "user", content: message, createdAt: new Date().toISOString() };
    setMessages((m) => [...m, optimistic]);
    try {
      const r = await apiFetch<{ conversationId: string; messages: ChatMessageDTO[] }>("/api/chat", { method: "POST", json: { conversationId: convId, message } });
      setConvId(r.conversationId);
      setMessages((m) => [...m.filter((x) => x.id !== optimistic.id), ...r.messages]);
      void loadList();
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setError({ text: e instanceof ApiClientError ? e.message : "Something went wrong.", retry: message });
    } finally {
      setSending(false);
    }
  }

  async function upload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("docType", "auto");
      const r = await apiFetch<{ document: DocumentDTO }>("/api/documents", { method: "POST", body: fd });
      toast(r.document.status === "processed" ? `${file.name} added to your records.` : `${file.name} saved but needs its text — see My Medical Records.`, r.document.status === "processed" ? "ok" : "err");
      if (r.document.status === "processed") await send(`I just uploaded “${r.document.title}”. Please summarise my records, including this new document.`);
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setUploading(false);
    }
  }

  function toggleMic() {
    const W = window as unknown as { SpeechRecognition?: SR; webkitSpeechRecognition?: SR };
    const Rec = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Rec) return toast("Voice input isn't supported in this browser.", "err");
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const r = new Rec();
    r.lang = "en-IN";
    r.interimResults = false;
    r.onresult = (e) => setInput((p) => (p ? p + " " : "") + e.results[0][0].transcript);
    r.onend = () => setListening(false);
    r.onerror = () => {
      setListening(false);
      toast("Couldn't hear that. Check microphone permission.", "err");
    };
    recRef.current = r;
    setListening(true);
    r.start();
  }

  function speak(m: ChatMessageDTO) {
    if (!("speechSynthesis" in window)) return toast("Read-aloud isn't supported in this browser.", "err");
    if (speaking === m.id) {
      window.speechSynthesis.cancel();
      return setSpeaking(null);
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(m.content.replace(/[#*_>`[\]]/g, "").replace(/\(\/[^)]*\)/g, ""));
    u.onend = () => setSpeaking(null);
    setSpeaking(m.id);
    window.speechSynthesis.speak(u);
  }

  const empty = messages.length === 0;

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100vh-7.5rem)] min-h-[520px] sm:-mx-8 sm:-my-8 sm:h-[calc(100vh-4.5rem)]">
      {/* history */}
      <aside className={`${showList ? "absolute inset-y-0 left-0 z-20 flex" : "hidden"} w-72 shrink-0 flex-col border-r border-navy-100 bg-white md:static md:flex`}>
        <div className="flex items-center justify-between p-4">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-navy-400">Conversations</h2>
          <button className="rounded-lg p-1 text-navy-400 hover:bg-navy-50 md:hidden" onClick={() => setShowList(false)} aria-label="Close history"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-3">
          <Button variant="secondary" className="w-full" icon={<Plus className="h-4 w-4" />} onClick={() => open(null)}>New conversation</Button>
        </div>
        <ul className="mt-3 flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
          {convs.length === 0 && <li className="px-3 py-4 text-[13px] text-navy-400">Your conversations will appear here.</li>}
          {convs.map((c) => (
            <li key={c.id} className="group flex items-center">
              <button onClick={() => open(c.id)} className={`min-w-0 flex-1 rounded-xl px-3 py-2 text-left transition ${convId === c.id ? "bg-sano-50 text-sano-900" : "text-navy-700 hover:bg-navy-50"}`}>
                <span className="line-clamp-1 text-[13.5px] font-medium">{c.title}</span>
                <span className="text-[11.5px] text-navy-400">{new Date(c.updated_at).toLocaleDateString("en-IN")}</span>
              </button>
              <button
                aria-label={`Delete conversation ${c.title}`}
                className="mr-1 rounded-lg p-1.5 text-navy-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100"
                onClick={async () => {
                  await apiFetch(`/api/chat/${c.id}`, { method: "DELETE" }).catch(() => {});
                  if (convId === c.id) await open(null);
                  void loadList();
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* thread */}
      <section className="relative flex min-w-0 flex-1 flex-col bg-paper">
        <div className="flex items-center justify-between gap-3 border-b border-navy-100 bg-white/70 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2.5">
            <button className="rounded-lg p-1.5 text-navy-500 hover:bg-navy-50 md:hidden" onClick={() => setShowList(true)} aria-label="Open conversation history"><History className="h-5 w-5" /></button>
            <LogoMark size={28} />
            <div>
              <h1 className="text-[15px] font-semibold text-navy-900">AI Health Assistant</h1>
              <p className="text-[12px] text-navy-400">{ctx?.memory ? "Using your records and profile as context" : "Not using your records (change in Settings)"}</p>
            </div>
          </div>
          <span className="hidden sm:block">
            <AiModeChip meta={{ mode: ctx?.mode === "live" ? "live" : "demo", provider: ctx?.mode === "live" ? "external AI" : "SanoAI rule-based engine" }} />
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6" aria-live="polite">
          <div className="mx-auto max-w-3xl space-y-6">
            {empty && (
              <div className="pt-6 text-center sm:pt-12">
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-navy-900 shadow-lift"><LogoMark size={40} /></motion.div>
                <h2 className="mt-5 text-2xl font-semibold text-navy-900">How can I help you understand your health?</h2>
                <p className="mx-auto mt-2 max-w-md text-[14.5px] text-navy-500">Ask about conditions, tests or your own reports. Answers cite their sources and say plainly what is uncertain.</p>
                <div className="mx-auto mt-6 flex max-w-xl flex-wrap justify-center gap-2">
                  {STARTERS.map((s) => (
                    <button key={s} onClick={() => send(s)} className="rounded-full border border-navy-100 bg-white px-3.5 py-2 text-[13px] text-navy-700 shadow-sm transition hover:border-sano-300 hover:text-sano-800">{s}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <Message key={m.id} m={m} onFollow={send} onSpeak={() => speak(m)} speaking={speaking === m.id} />
            ))}
            {sending && (
              <div className="flex items-center gap-3" role="status">
                <LogoMark size={30} />
                <div className="flex items-center gap-1.5 rounded-2xl bg-white px-4 py-3 shadow-soft">
                  {[0, 1, 2].map((i) => (
                    <motion.span key={i} className="h-2 w-2 rounded-full bg-sano-400" animate={{ y: [0, -5, 0], opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
                  ))}
                  <span className="ml-2 text-[13px] text-navy-400">Checking sources…</span>
                </div>
              </div>
            )}
            {error && <ErrorState message={error.text} onRetry={error.retry ? () => send(error.retry) : undefined} />}
            <div ref={bottom} />
          </div>
        </div>

        <div className="border-t border-navy-100 bg-white px-4 py-3 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex items-end gap-2 rounded-2xl border border-navy-100 bg-white p-2 shadow-soft focus-within:border-sano-400 focus-within:ring-4 focus-within:ring-sano-200/50">
              <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Upload a medical document" title="Upload a document to your records" className="rounded-xl p-2.5 text-navy-400 transition hover:bg-navy-50 hover:text-navy-700 disabled:opacity-50">
                <Paperclip className={`h-5 w-5 ${uploading ? "animate-pulse" : ""}`} />
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                rows={1}
                maxLength={2000}
                placeholder="Ask about a condition, a test, or your own records…"
                aria-label="Message"
                className="max-h-36 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2.5 text-[14.5px] text-navy-900 outline-none placeholder:text-navy-300"
              />
              <button type="button" onClick={toggleMic} aria-label={listening ? "Stop voice input" : "Start voice input"} className={`rounded-xl p-2.5 transition ${listening ? "bg-rose-50 text-rose-600" : "text-navy-400 hover:bg-navy-50 hover:text-navy-700"}`}>
                {listening ? <Square className="h-5 w-5 animate-pulse" /> : <Mic className="h-5 w-5" />}
              </button>
              <Button type="submit" disabled={!input.trim() || sending} aria-label="Send message" className="!h-11 !w-11 !rounded-xl !p-0"><Send className="h-[18px] w-[18px]" /></Button>
            </form>
            <p className="mt-2 text-center text-[11.5px] text-navy-400">SanoAI is not a doctor and can make mistakes. For emergencies call 112.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Message({ m, onFollow, onSpeak, speaking }: { m: ChatMessageDTO; onFollow: (t: string) => void; onSpeak: () => void; speaking: boolean }) {
  const [showU, setShowU] = useState(false);
  const [hi, setHi] = useState<number | null>(null);
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-navy-900 px-4 py-3 text-[14.5px] leading-relaxed text-white shadow-soft">{m.content}</div>
      </div>
    );
  }
  const meta = m.meta;
  const u = meta?.uncertainty;
  return (
    <div className="flex gap-3">
      <LogoMark size={30} className="mt-1 shrink-0" />
      <div className="min-w-0 max-w-[92%] flex-1">
        {meta?.safety && (
          <Callout tone={meta.safety.level === "emergency" ? "alert" : "warn"} title={meta.safety.level === "emergency" ? "Possible emergency" : "May need prompt medical attention"} className="mb-2">
            {meta.safety.level === "emergency" ? "Call 112 now." : "Please contact a clinician or urgent-care service today."}
          </Callout>
        )}
        <div className="rounded-2xl rounded-tl-md bg-white px-5 py-4 shadow-soft">
          <Markdown text={m.content} onCite={(n) => setHi(n)} />
          {meta?.modules && meta.modules.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-navy-100 pt-3">
              <span className="text-[12px] text-navy-400">Related:</span>
              {meta.modules.map((x) => (
                <Link key={x.href} href={x.href} className="rounded-full bg-sano-50 px-2.5 py-0.5 text-[12px] font-medium text-sano-800 hover:bg-sano-100">{x.label}</Link>
              ))}
            </div>
          )}
          {u && (u.known.length > 0 || u.unsure.length > 0 || u.missing.length > 0) && (
            <div className="mt-3 border-t border-navy-100 pt-2">
              <button onClick={() => setShowU((s) => !s)} aria-expanded={showU} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-navy-500 hover:text-navy-800">
                How certain is this? <ChevronDown className={`h-3.5 w-3.5 transition ${showU ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {showU && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="mt-2 grid gap-2 text-[12.5px] sm:grid-cols-3">
                      {[
                        ["Known", u.known, "border-sano-300 bg-sano-50/60"],
                        ["Uncertain", u.unsure, "border-amber-300 bg-amber-50/60"],
                        ["Missing", u.missing, "border-slate-300 border-dashed bg-slate-50"],
                      ].map(([t, list, cls]) => (
                        <div key={t as string} className={`rounded-xl border p-2.5 ${cls}`}>
                          <p className="font-semibold text-navy-800">{t as string}</p>
                          <ul className="mt-1 space-y-1 text-navy-600">{(list as string[]).map((x) => <li key={x}>• {x}</li>)}</ul>
                        </div>
                      ))}
                    </div>
                    <Link href="/uncertainty" className="mt-2 inline-block text-[12px] font-medium text-sano-700 hover:underline">Open the full Uncertainty Engine</Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          {meta?.citations && meta.citations.length > 0 && (
            <div className="mt-3 border-t border-navy-100 pt-3">
              <p className="text-[11.5px] font-semibold uppercase tracking-wide text-navy-400">Sources</p>
              <ol className="mt-1.5 space-y-1">
                {meta.citations.map((c) => (
                  <li key={c.n} className={`text-[12.5px] transition ${hi === c.n ? "rounded bg-sano-50" : ""}`}>
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-navy-600 hover:text-sano-700">
                      <span className="font-semibold text-sano-700">[{c.n}]</span> {c.title} <span className="text-navy-400">— {c.publisher}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 px-1">
          {meta?.ai && <AiModeChip meta={meta.ai} />}
          {meta?.usedRecords && <Badge tone="teal">Used your records</Badge>}
          <button onClick={onSpeak} aria-label={speaking ? "Stop reading aloud" : "Read aloud"} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] hover:bg-navy-50 ${speaking ? "text-sano-700" : "text-navy-400"}`}>
            <Volume2 className="h-3.5 w-3.5" /> {speaking ? "Stop" : "Read aloud"}
          </button>
        </div>
        {meta?.ai?.notice && <p className="mt-1 px-1 text-[12px] text-navy-400">{meta.ai.notice}</p>}
        {meta?.followUps && meta.followUps.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {meta.followUps.map((f) => (
              <button key={f} onClick={() => onFollow(f)} className="rounded-full border border-navy-100 bg-white px-3 py-1.5 text-[12.5px] text-navy-600 transition hover:border-sano-300 hover:text-sano-800">{f}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AssistantPage() {
  return (
    <Suspense>
      <Assistant />
    </Suspense>
  );
}
