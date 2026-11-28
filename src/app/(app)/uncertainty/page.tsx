"use client";
import { motion } from "framer-motion";
import { Gauge, Send } from "lucide-react";
import { useState } from "react";
import type { Basis, UStatement, UncertaintyAssessment } from "@/ai/types";
import { AiModeChip, Badge, Button, Callout, Card, ErrorState, LimitsNote, LoadingBlock, MetaNotice, PageHeader, SourceList, Toggle, type Tone } from "@/components/ui";
import { apiFetch } from "@/lib/client";

const EXAMPLES = ["My vitamin B12 is low. What does that mean?", "I keep feeling tired and my haemoglobin was low", "What could a raised TSH mean?", "My blood pressure reading was high at the clinic"];

const LANES: { key: keyof Pick<UncertaintyAssessment, "supported" | "possibilities" | "missing" | "alternatives" | "professional">; title: string; sub: string; bar: string; border: string; chip: Tone }[] = [
  { key: "supported", title: "Supported", sub: "Backed by your records or a cited reference", bar: "bg-sano-500", border: "border-l-sano-500", chip: "teal" },
  { key: "possibilities", title: "Only a possibility", sub: "Might apply — not established for you", bar: "bg-amber-400", border: "border-l-amber-400", chip: "amber" },
  { key: "missing", title: "Information missing", sub: "What a clinician would want to know", bar: "bg-slate-400", border: "border-l-slate-400 border-dashed", chip: "slate" },
  { key: "alternatives", title: "Alternative explanations", sub: "Other things that could account for this", bar: "bg-sky-400", border: "border-l-sky-400", chip: "sky" },
  { key: "professional", title: "Needs a professional", sub: "Only a clinician can settle this", bar: "bg-rose-400", border: "border-l-rose-400", chip: "rose" },
];

const BASIS: Record<Basis, { label: string; tone: Tone }> = {
  records: { label: "From your records", tone: "teal" },
  reference: { label: "Cited reference", tone: "sky" },
  "ai-general": { label: "General knowledge — no citation", tone: "slate" },
};

function Statement({ s, sources }: { s: UStatement; sources: UncertaintyAssessment["sources"] }) {
  const b = BASIS[s.basis];
  const refs = s.sourceIds.map((id) => sources.find((x) => x.id === id)).filter(Boolean);
  return (
    <li className="text-[14px] leading-relaxed text-navy-700">
      {s.text}
      <span className="ml-2 inline-flex flex-wrap items-center gap-1 align-middle">
        <Badge tone={b.tone}>{b.label}</Badge>
        {refs.slice(0, 2).map((r) => (
          <a key={r!.id} href={r!.url} target="_blank" rel="noopener noreferrer" className="text-[11.5px] text-sano-700 underline underline-offset-2">
            {r!.publisher.split(" (")[0]}
          </a>
        ))}
      </span>
    </li>
  );
}

export default function UncertaintyPage() {
  const [q, setQ] = useState("");
  const [useRecords, setUseRecords] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<{ result: UncertaintyAssessment; safety: { level: string; message: string } | null; usedRecords: boolean } | null>(null);

  async function ask(question = q) {
    if (question.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
      setRes(await apiFetch("/api/uncertainty", { method: "POST", json: { question, useRecords } }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const r = res?.result;
  const total = r ? LANES.reduce((n, l) => n + r[l.key].length, 0) || 1 : 1;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="How sure can we be?" title="What's known, and what isn't" description="Ask a question. SanoAI separates what your records support from what is only possible or still missing." />

      <Card className="card-pad">
        <label htmlFor="uq" className="text-[13px] font-medium text-navy-700">What would you like to understand?</label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <textarea id="uq" rows={2} className="field flex-1 resize-none" placeholder="e.g. My vitamin B12 is low — what does that mean?" value={q} maxLength={600} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(); } }} />
          <Button size="lg" onClick={() => ask()} loading={busy} icon={<Send className="h-4 w-4" />} disabled={q.trim().length < 3}>
            Assess
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((e) => (
            <button key={e} onClick={() => { setQ(e); void ask(e); }} className="rounded-full bg-navy-50 px-3 py-1.5 text-[12.5px] text-navy-600 transition hover:bg-sano-50 hover:text-sano-800">
              {e}
            </button>
          ))}
        </div>
        <div className="mt-4 border-t border-navy-100 pt-4">
          <Toggle checked={useRecords} onChange={setUseRecords} label="Use my records as context" description="Lets the engine point out what your own documents do and don't contain." />
        </div>
      </Card>

      {busy && <LoadingBlock rows={3} label="Weighing what is known and unknown" />}
      {error && <ErrorState message={error} onRetry={() => ask()} />}

      {r && !busy && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          {res.safety && <Callout tone={res.safety.level === "emergency" ? "alert" : "warn"} title={res.safety.level === "emergency" ? "Please seek urgent help" : "This may need prompt assessment"}>{res.safety.message}</Callout>}
          <div className="flex flex-wrap items-center gap-2">
            <AiModeChip meta={r.meta} />
            <Badge tone="slate">{res.usedRecords ? "Using your records" : "Without your records"}</Badge>
            <span className="text-[12.5px] text-navy-400">Topic: {r.topic}</span>
          </div>
          <MetaNotice meta={r.meta} />

          {/* the uncertainty spectrum */}
          <Card className="card-pad">
            <div className="flex items-center gap-2"><Gauge className="h-5 w-5 text-sano-600" /><h2 className="text-[15px] font-semibold text-navy-900">The shape of this answer</h2></div>
            <p className="mt-1 text-[13px] text-navy-500">Bar widths show how many statements fall in each category — a picture of what is solid versus open, not a probability.</p>
            <div className="mt-4 flex h-3.5 w-full overflow-hidden rounded-full bg-navy-100" role="img" aria-label={LANES.map((l) => `${r[l.key].length} ${l.title}`).join(", ")}>
              {LANES.map((l) => (
                <motion.div key={l.key} initial={{ width: 0 }} animate={{ width: `${(r[l.key].length / total) * 100}%` }} transition={{ duration: 0.8, ease: "easeOut" }} className={`${l.bar} ${l.key === "missing" ? "opacity-70" : ""}`} title={`${l.title}: ${r[l.key].length}`} />
              ))}
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px] text-navy-600">
              {LANES.map((l) => (
                <li key={l.key} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${l.bar}`} />{l.title} <strong>{r[l.key].length}</strong></li>
              ))}
            </ul>
            <div className="mt-5 rounded-2xl bg-navy-900 p-5 text-white">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-sano-300">Why SanoAI cannot give a definitive answer</p>
              <ul className="mt-2 space-y-2">
                {r.whyNotDefinitive.map((w, i) => (
                  <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-navy-100"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sano-400" />{w}</li>
                ))}
              </ul>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {LANES.map((l, i) => (
              <motion.div key={l.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 * i }} className={i === 0 ? "lg:col-span-2" : ""}>
                <Card className={`border-l-4 ${l.border} card-pad h-full`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-[15px] font-semibold text-navy-900">{l.title}</h3>
                    <span className="text-[12px] text-navy-400">{l.sub}</span>
                  </div>
                  {r[l.key].length ? (
                    <ul className="mt-3 space-y-2.5">
                      {r[l.key].map((s, j) => (
                        <Statement key={j} s={s} sources={r.sources} />
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-navy-400">Nothing to list here.</p>
                  )}
                </Card>
              </motion.div>
            ))}
          </div>
          <Card className="card-pad"><SourceList sources={r.sources} /></Card>
        </motion.div>
      )}
      <LimitsNote>Basis labels tell you where each statement comes from. “General knowledge — no citation” means it could not be tied to your records or a cited reference and should be treated with extra caution. No confidence percentages are ever shown because none could be defended.</LimitsNote>
    </div>
  );
}
