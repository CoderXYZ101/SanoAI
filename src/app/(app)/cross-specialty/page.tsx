"use client";
import { Check, ChevronDown, Minus, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import type { Connection, CrossSpecialtyResult } from "@/ai/types";
import { CopyButton, EvidenceList, NoRecords, useDocMap } from "@/components/common";
import BodyNetworkLazy from "@/components/three/BodyNetworkLazy";
import { AiModeChip, Badge, Button, Callout, Card, ErrorState, LimitsNote, LoadingBlock, MetaNotice, PageHeader, SourceList, useToast } from "@/components/ui";
import { apiFetch, useApi } from "@/lib/client";

type Data = { result: CrossSpecialtyResult; ai: { effective: string; reason: string }; hasRecords: boolean };

function ConnectionCard({ c, docs }: { c: Connection; docs: ReturnType<typeof useDocMap>["map"] }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="card-pad">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={c.strength === "documented" ? "teal" : "slate"}>{c.strength === "documented" ? "Supported by 2+ areas of your records" : "Partial — only some of this appears in your records"}</Badge>
        {c.specialties.map((s) => (
          <Badge key={s} tone="navy">{s}</Badge>
        ))}
      </div>
      <h3 className="mt-2 text-[16px] font-semibold text-navy-900">{c.title}</h3>
      <ul className="mt-3 space-y-1.5">
        {c.matched.map((m) => (
          <li key={m.label} className="flex items-start gap-2 text-[13.5px] text-navy-700">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-sano-600" /> {m.label}
          </li>
        ))}
        {c.notFound.map((n) => (
          <li key={n} className="flex items-start gap-2 text-[13.5px] text-navy-400">
            <Minus className="mt-0.5 h-4 w-4 shrink-0" /> {n} <span className="text-[12px]">— not found in your records</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[13.5px] leading-relaxed text-navy-600">{c.why}</p>
      <p className="mt-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-amber-900">{c.caution}</p>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-sano-700 hover:underline">
        Questions &amp; evidence <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-2 space-y-3">
          <ul className="list-disc space-y-1 pl-5 text-[13.5px] text-navy-700">
            {c.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
          <EvidenceList evidence={c.matched.flatMap((m) => m.evidence)} docs={docs} max={4} />
        </div>
      )}
    </Card>
  );
}

export default function CrossSpecialtyPage() {
  const { data, error, loading, reload, setData } = useApi<Data>("/api/cross-specialty");
  const { map } = useDocMap();
  const [selected, setSelected] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const toast = useToast();
  const r = data?.result;

  const shown = useMemo(() => (r ? r.connections.filter((c) => !selected || c.specialties.includes(selected as never)) : []), [r, selected]);
  const prep = r?.consultPrep.find((p) => p.specialty === selected);
  const prepText = useMemo(
    () => (r ? r.consultPrep.map((p) => `${p.specialty.toUpperCase()}\nBring: ${p.bring.join("; ") || "—"}\nAsk: ${p.ask.join(" | ") || "—"}`).join("\n\n") : ""),
    [r],
  );

  async function run() {
    setRunning(true);
    try {
      setData(await apiFetch<Data>("/api/cross-specialty", { method: "POST" }));
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setRunning(false);
    }
  }

  if (loading && !data) return <LoadingBlock rows={4} />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data || !r) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cross-Specialty Medical Intelligence"
        title="Where your specialties meet"
        description="Findings from one specialty can matter to another. SanoAI places each area on a 3D body map and links the ones your own records connect — as associations to raise with your clinicians, never as diagnoses."
        actions={
          data.hasRecords && (
            <Button variant="secondary" onClick={run} loading={running} icon={<Sparkles className="h-4 w-4" />}>
              {data.ai.effective === "live" ? "Write AI summary" : "Refresh"}
            </Button>
          )
        }
      />
      {!data.hasRecords ? (
        <NoRecords what="Cross-specialty analysis" onLoaded={reload} />
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-navy-900 to-navy-950 shadow-lift">
              <div className="bg-grid pointer-events-none absolute inset-0 opacity-70" />
              <BodyNetworkLazy className="relative h-[440px] w-full sm:h-[520px]" nodes={r.specialtiesInvolved.map((s) => ({ specialty: s.specialty, count: s.items.length }))} edges={r.edges.map((e) => ({ a: e.a, b: e.b, count: e.count }))} selected={selected} onSelect={setSelected} />
              <div className="pointer-events-none absolute bottom-3 left-4 right-4 flex items-end justify-between text-[11.5px] text-navy-300">
                <span>Drag to rotate · click a region to focus</span>
                <span>Arc thickness = number of connections found</span>
              </div>
            </div>
            <div className="space-y-4">
              <Card className="card-pad">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-[15px] font-semibold text-navy-900">Integrated summary</h2>
                  <AiModeChip meta={r.meta} />
                </div>
                <p className="mt-2 text-[14px] leading-relaxed text-navy-700">{r.integratedSummary}</p>
                <MetaNotice meta={r.meta} />
              </Card>
              <Card className="card-pad">
                <div className="flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold text-navy-900">Areas in your records</h2>
                  {selected && <button className="text-[12.5px] font-medium text-sano-700 hover:underline" onClick={() => setSelected(null)}>Show all</button>}
                </div>
                <ul className="mt-3 space-y-1.5">
                  {r.specialtiesInvolved.map((s) => (
                    <li key={s.specialty}>
                      <button onClick={() => setSelected(selected === s.specialty ? null : s.specialty)} className={`w-full rounded-xl px-3 py-2 text-left transition ${selected === s.specialty ? "bg-navy-900 text-white" : "hover:bg-navy-50"}`}>
                        <span className="text-[13.5px] font-semibold">{s.specialty}</span>
                        <span className={`mt-0.5 block text-[12px] ${selected === s.specialty ? "text-navy-200" : "text-navy-500"}`}>{s.items.join(" · ")}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>

          {prep && (
            <Callout tone="teal" title={`Preparing for ${prep.specialty}`}>
              <p><strong>Bring:</strong> {prep.bring.join("; ") || "—"}</p>
              <p className="mt-1"><strong>Ask:</strong> {prep.ask.join(" · ") || "—"}</p>
            </Callout>
          )}

          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-[17px] font-semibold text-navy-900">Connections{selected ? ` involving ${selected}` : ""}</h2>
                <p className="text-[13px] text-navy-500">{shown.length} found</p>
              </div>
              <CopyButton text={prepText} label="Copy consultation prep" />
            </div>
            {shown.length ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {shown.map((c) => (
                  <ConnectionCard key={c.id} c={c} docs={map} />
                ))}
              </div>
            ) : (
              <Callout tone="info">No connections were identified from the information provided{selected ? " for this specialty" : ""}. That does not mean none exist — only that they can&apos;t be seen in these records.</Callout>
            )}
          </section>

          {r.coordinationQuestions.length > 0 && (
            <Card className="card-pad">
              <h2 className="text-[15px] font-semibold text-navy-900">Questions that may need coordination between specialists</h2>
              <ul className="mt-3 list-decimal space-y-1.5 pl-5 text-[14px] text-navy-700">
                {r.coordinationQuestions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </Card>
          )}
          <Card className="card-pad"><SourceList sources={r.sources} /></Card>
        </>
      )}
      <LimitsNote>Connections describe associations documented in public medical references. They do not prove that one finding causes another and are not diagnoses. Only your clinicians can judge relevance to you.</LimitsNote>
    </div>
  );
}
