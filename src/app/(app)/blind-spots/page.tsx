"use client";
import { AlertOctagon, CheckCircle2, HelpCircle, MessageCircleQuestion, ScanSearch, Sparkles } from "lucide-react";
import { useState } from "react";
import type { BlindSpotResult, DocumentDTO, Finding } from "@/ai/types";
import { CopyButton, EvidenceList, NoRecords, useDocMap } from "@/components/common";
import { AiModeChip, Badge, Button, Callout, Card, ErrorState, LimitsNote, LoadingBlock, MetaNotice, PageHeader, useToast } from "@/components/ui";
import { apiFetch, useApi } from "@/lib/client";

type Data = { result: BlindSpotResult; cached: boolean; ai: { effective: string; reason: string }; documents: number };

function FindingCard({ f, docs, tone }: { f: Finding; docs: Map<string, DocumentDTO>; tone: "ok" | "unclear" | "q" }) {
  const [open, setOpen] = useState(false);
  const kindBadge =
    f.kind === "conflict" ? <Badge tone="rose">Records differ</Badge> : f.kind === "missing" ? <Badge tone="slate">Not found in records</Badge> : f.kind === "unclear" ? <Badge tone="amber">Unclear</Badge> : null;
  return (
    <li className={`rounded-2xl border bg-white p-4 shadow-soft ${tone === "ok" ? "border-sano-200/70" : tone === "q" ? "border-sky-200/80" : f.kind === "conflict" ? "border-rose-200" : "border-amber-200/80"}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        {kindBadge}
        {f.source === "ai" && <Badge tone="teal" icon={<Sparkles className="h-3 w-3" />}>AI-suggested</Badge>}
      </div>
      <p className="mt-1.5 text-[14.5px] font-semibold leading-snug text-navy-900">{f.title}</p>
      {f.detail && <p className="mt-1 text-[13.5px] leading-relaxed text-navy-600">{f.detail}</p>}
      <div className="mt-2.5 rounded-xl bg-navy-50/70 px-3.5 py-2.5">
        <p className="text-[11.5px] font-semibold uppercase tracking-wide text-navy-400">Why it matters</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-navy-600">{f.why}</p>
      </div>
      {f.evidence.some((e) => e.quote) && (
        <>
          <button onClick={() => setOpen((o) => !o)} className="mt-2 text-[12.5px] font-medium text-sano-700 hover:underline" aria-expanded={open}>
            {open ? "Hide" : "Show"} source lines
          </button>
          {open && <EvidenceList evidence={f.evidence} docs={docs} max={4} />}
        </>
      )}
    </li>
  );
}

export default function BlindSpotsPage() {
  const { data, error, loading, reload, setData } = useApi<Data>("/api/blind-spots");
  const { map } = useDocMap();
  const [running, setRunning] = useState(false);
  const toast = useToast();

  async function run() {
    setRunning(true);
    try {
      setData(await apiFetch<Data>("/api/blind-spots", { method: "POST" }));
      toast("Analysis updated.");
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setRunning(false);
    }
  }

  if (loading && !data) return <LoadingBlock rows={4} label="Scanning your records" />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const r = data.result;
  const hasRecords = r.confirmed.length + r.unclear.length > 0;
  const questionText = r.questions.map((q, i) => `${i + 1}. ${q.title}`).join("\n");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Diagnostic Blind-Spot Detector"
        title="What your records don't say"
        description="SanoAI reads across your documents for information that is unclear, missing or inconsistent — and turns it into questions to discuss with a clinician. It never says a diagnosis was missed or that anyone made a mistake."
        actions={
          <Button onClick={run} loading={running} icon={<ScanSearch className="h-4 w-4" />} disabled={!hasRecords}>
            {data.ai.effective === "live" ? "Run deeper AI analysis" : "Re-run analysis"}
          </Button>
        }
      />

      {!hasRecords ? (
        <NoRecords what="The Blind-Spot Detector" onLoaded={reload} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <AiModeChip meta={r.meta} />
            <span className="text-[12.5px] text-navy-400">{r.confirmed.length} confirmed · {r.unclear.length} unclear or missing · {r.questions.length} questions</span>
          </div>
          <MetaNotice meta={r.meta} />
          <Callout tone="info">Everything here is based <strong>only on the documents you provided</strong>. A clinician may hold information that is not in these records, and many gaps have ordinary explanations.</Callout>

          <div className="grid gap-6 xl:grid-cols-3">
            <section aria-labelledby="c1">
              <div className="mb-3 flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sano-100 text-sano-700"><CheckCircle2 className="h-[18px] w-[18px]" /></span>
                <div>
                  <h2 id="c1" className="text-[15px] font-semibold text-navy-900">Confirmed in your records</h2>
                  <p className="text-[12.5px] text-navy-400">Written in your documents · {r.confirmed.length}</p>
                </div>
              </div>
              <ul className="space-y-3">
                {r.confirmed.map((f) => (
                  <FindingCard key={f.id} f={f} docs={map} tone="ok" />
                ))}
              </ul>
            </section>

            <section aria-labelledby="c2">
              <div className="mb-3 flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><AlertOctagon className="h-[18px] w-[18px]" /></span>
                <div>
                  <h2 id="c2" className="text-[15px] font-semibold text-navy-900">Unclear or missing</h2>
                  <p className="text-[12.5px] text-navy-400">Gaps and conflicts · {r.unclear.length}</p>
                </div>
              </div>
              {r.unclear.length ? (
                <ul className="space-y-3">
                  {[...r.unclear].sort((a, b) => (a.kind === "conflict" ? -1 : 0) - (b.kind === "conflict" ? -1 : 0)).map((f) => (
                    <FindingCard key={f.id} f={f} docs={map} tone="unclear" />
                  ))}
                </ul>
              ) : (
                <Callout tone="teal" title="No gaps found in the information provided" />
              )}
            </section>

            <section aria-labelledby="c3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 text-sky-700"><MessageCircleQuestion className="h-[18px] w-[18px]" /></span>
                  <div>
                    <h2 id="c3" className="text-[15px] font-semibold text-navy-900">Worth discussing</h2>
                    <p className="text-[12.5px] text-navy-400">Questions for a professional · {r.questions.length}</p>
                  </div>
                </div>
                {r.questions.length > 0 && <CopyButton text={questionText} label="Copy all" />}
              </div>
              {r.questions.length ? (
                <ul className="space-y-3">
                  {r.questions.map((f) => (
                    <FindingCard key={f.id} f={f} docs={map} tone="q" />
                  ))}
                </ul>
              ) : (
                <Card className="card-pad text-sm text-navy-500"><HelpCircle className="mb-2 h-5 w-5 text-navy-300" />No outstanding questions.</Card>
              )}
            </section>
          </div>
        </>
      )}
      <LimitsNote>This tool highlights information for discussion. It does not diagnose, does not assess the quality of care, and cannot know what happened outside your documents.</LimitsNote>
    </div>
  );
}
